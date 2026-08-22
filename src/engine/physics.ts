import * as CANNON from 'cannon-es'

export interface BallBody {
  id: number
  radius: number
  userData: unknown
  x(): number
  y(): number
  isAtRest(): boolean
}

export interface PhysicsWorld {
  step(dt: number): void
  addBall(radius: number, x: number, y: number, userData: unknown): BallBody
  removeBall(b: BallBody): void
  setSleeping(b: BallBody, sleeping: boolean): void
  bodies(): BallBody[]
  onSameLevelContact(cb: (a: BallBody, b: BallBody) => void): () => void
}

interface WorldOpts { width: number; height: number; seed: number }

const REST_SPEED = 0.05
const CONTACT_DELAY_FRAMES = 6 // 0.1s @ 60fps，防误触

export function createPhysicsWorld(opts: WorldOpts): PhysicsWorld {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) })
  // 无 SAP/Grid broadphase：无限 Plane 墙体与 SAP 排序不兼容，且球体数量小，默认 broadphase 足够
  world.allowSleep = true

  const halfW = opts.width / 2
  const wallMat = new CANNON.Material('wall')
  const ballMat = new CANNON.Material('ball')
  const contactMat = new CANNON.ContactMaterial(ballMat, ballMat, { friction: 0.2, restitution: 0.1 })
  const wallContact = new CANNON.ContactMaterial(ballMat, wallMat, { friction: 0.2, restitution: 0.1 })
  world.addContactMaterial(contactMat)
  world.addContactMaterial(wallContact)

  const floor = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Plane() })
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  floor.position.set(0, 0, 0)
  world.addBody(floor)
  for (const sx of [-1, 1]) {
    const wall = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Plane() })
    // Plane 默认法线为 +z；绕 Y 旋转使法线朝容器内侧（-sx*x 方向），实体在容器外侧
    wall.quaternion.setFromEuler(0, -Math.PI / 2 * sx, 0)
    wall.position.set(sx * halfW, opts.height / 2, 0)
    world.addBody(wall)
  }

  let nextId = 0
  const balls: BallBody[] = []
  const sleeping = new Set<number>()
  const contactCbs: Array<(a: BallBody, b: BallBody) => void> = []
  const pending: Array<[number, number, number]> = [] // [aId, bId, frameCount]

  const bodyById = (id: number): BallBody | undefined => balls.find((b) => b.id === id)

  world.addEventListener('postStep', () => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const [aid, bid, frames] = pending[i]
      if (sleeping.has(aid) || sleeping.has(bid)) {
        pending.splice(i, 1)
        continue
      }
      if (frames >= CONTACT_DELAY_FRAMES) {
        const a = bodyById(aid)
        const b = bodyById(bid)
        if (a && b) {
          const la = a.userData as { level: number }
          const lb = b.userData as { level: number }
          if (la.level === lb.level) {
            for (const cb of contactCbs) cb(a, b)
          }
        }
        pending.splice(i, 1)
      } else {
        pending[i] = [aid, bid, frames + 1]
      }
    }
  })

  world.addEventListener('beginContact', (ev: { bodyA: CANNON.Body; bodyB: CANNON.Body }) => {
    const a = (ev.bodyA as CANNON.Body & { userData: unknown }).userData as { __ballId?: number } | undefined
    const b = (ev.bodyB as CANNON.Body & { userData: unknown }).userData as { __ballId?: number } | undefined
    const aid = a?.__ballId, bid = b?.__ballId
    if (aid === undefined || bid === undefined) return
    if (!pending.some(([pa, pb]) => (pa === aid && pb === bid) || (pa === bid && pb === aid))) {
      pending.push([aid, bid, 0])
    }
  })

  return {
    step(dt) {
      world.step(1 / 60, dt, 3)
    },
    addBall(radius, x, y, userData) {
      const id = nextId++
      const body = new CANNON.Body({
        mass: 1,
        material: ballMat,
        shape: new CANNON.Sphere(radius),
        position: new CANNON.Vec3(x, y, 0)
      })
      body.fixedRotation = true
      body.linearFactor.set(1, 1, 0) // 锁定 z 轴：2D 物理（cannon-es 为 3D 引擎）
      body.angularFactor.set(0, 0, 0)
      ;(body as CANNON.Body & { userData: unknown }).userData = { __ballId: id, level: (userData as { level: number }).level }
      world.addBody(body)
      const ball: BallBody = {
        id,
        radius,
        userData,
        x: () => body.position.x,
        y: () => body.position.y,
        isAtRest: () => {
          const v = body.velocity
          return Math.hypot(v.x, v.y) < REST_SPEED
        }
      }
      balls.push(ball)
      return ball
    },
    removeBall(b) {
      const i = balls.findIndex((x) => x.id === b.id)
      if (i >= 0) balls.splice(i, 1)
      const body = world.bodies.find((x) => ((x as CANNON.Body & { userData: unknown }).userData as { __ballId?: number })?.__ballId === b.id)
      if (body) world.removeBody(body)
    },
    setSleeping(b, sleepingFlag) {
      if (sleepingFlag) sleeping.add(b.id)
      else sleeping.delete(b.id)
    },
    bodies: () => [...balls],
    onSameLevelContact(cb) {
      contactCbs.push(cb)
      return () => {
        const i = contactCbs.indexOf(cb)
        if (i >= 0) contactCbs.splice(i, 1)
      }
    }
  }
}