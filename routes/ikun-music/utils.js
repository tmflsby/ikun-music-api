const axios = require('axios')

const TOKEN = 5381

// 公共参数
const commonParams = {
  g_tk: TOKEN,
  loginUin: 0,
  hostUin: 0,
  inCharset: 'utf8',
  outCharset: 'utf-8',
  notice: 0,
  needNewCode: 0,
  format: 'json',
  platform: 'yqq.json'
}

// 歌曲图片加载失败时使用的默认图片
const fallbackPicUrl = 'https://y.gtimg.cn/mediastyle/music_v11/extra/default_300x300.jpg?max_age=31536000'

// 获取一个随机数值
const getRandomVal = (prefix = '') => prefix + `${Math.random()}`.replace('0.', '')

// 获取一个随机 uid
const getUid = () => {
  const t = (new Date()).getUTCMilliseconds()
  return '' + Math.round(2147483647 * Math.random()) * t % 1e10
}

// 对 axios get 请求的封装
// 修改请求的 headers 值，合并公共请求参数
const get = (url, params) => axios.get(url, {
  headers: {
    referer: 'https://y.qq.com/',
    origin: 'https://y.qq.com/'
  },
  params: Object.assign({}, commonParams, params)
})

// 对 axios post 请求的封装
// 修改请求的 headers 值
const post = (url, data, params) => axios.post(url, data, {
  headers: {
    referer: 'https://y.qq.com/',
    origin: 'https://y.qq.com/',
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  params: Object.assign({}, commonParams, params)
})

// 处理歌曲列表
const handleSongList = (list) => {
  const songList = []
  list.forEach((item) => {
    const info = item.songInfo || item

    // 过滤付费歌曲和获取不到时长的歌曲
    if (info.pay.pay_play !== 0 || !info.interval) return

    // 构造歌曲的数据结构
    const song = {
      id: info.id,
      mid: info.mid,
      name: info.name,
      singer: mergeSinger(info.singer),
      url: '', // 在另一个接口获取
      duration: info.interval,
      pic: info.album.mid ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${info.album.mid}.jpg?max_age=2592000` : fallbackPicUrl,
      album: info.album.name
    }

    songList.push(song)
  })

  return songList
}

// 合并多个歌手的姓名
const mergeSinger = (singer) => {
  const ret = []
  if (!singer) return ''
  singer.forEach((s) => {
    ret.push(s.name)
  })
  return ret.join('/')
}

module.exports = {
  TOKEN,
  fallbackPicUrl,
  getRandomVal,
  getUid,
  get,
  post,
  handleSongList,
  mergeSinger
}
