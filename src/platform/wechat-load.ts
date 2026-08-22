declare const wx: {
  request(opts: { url: string; responseType: string; success: (r: { data: ArrayBuffer }) => void; fail: (e: unknown) => void }): void
}

export function loadWechatAsset(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      responseType: 'arraybuffer',
      success: (r) => resolve(r.data),
      fail: (e) => reject(e)
    })
  })
}