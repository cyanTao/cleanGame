/* 启动入口：加载素材 → 主菜单 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const C = PVZ.core;
  const S = PVZ.sprites;

  function startLoading() {
    const Engine = C.Engine;
    Engine.start();
    C.Input.init();
    C.Save.load();

    const loadScene = {
      progress: 0,
      update: function () {},
      onDown: function () {},
      render: function (ctx) {
        ctx.fillStyle = '#1b2e14';
        ctx.fillRect(0, 0, 960, 540);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#aed581';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('植物大战僵尸', 480, 220);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#81c784';
        ctx.fillText('正在载入素材… ' + Math.round(this.progress * 100) + '%', 480, 280);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(330, 310, 300, 22, 11) : ctx.rect(330, 310, 300, 22);
        ctx.fill();
        ctx.fillStyle = '#7cb342';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(332, 312, Math.max(8, 296 * this.progress), 18, 9) : ctx.rect(332, 312, Math.max(8, 296 * this.progress), 18);
        ctx.fill();
      }
    };
    C.setScene(loadScene);

    S.loadAll(function (p) {
      loadScene.progress = p;
    }).then(function () {
      C.setScene(new PVZ.MenuScene());
    });
  }

  PVZ.boot = startLoading;

  // 自动启动
  startLoading();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
