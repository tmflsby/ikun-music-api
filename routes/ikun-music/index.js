const router = require('koa-router')()
const pinyin = require('pinyin')
const Base64 = require('js-base64').Base64

const getSecuritySign = require('./sign')
const {
  TOKEN,
  getRandomVal,
  getUid,
  get,
  post,
  handleSongList,
} = require('./utils')

const CODE_SUCCESS = 0
const BASE_URL = 'https://u.y.qq.com/cgi-bin/musics.fcg'

router.prefix('/ikun-music')

// 推荐列表
router.get('/recommend', async (ctx, next) => {
  // 构造请求 data 参数
  const data = JSON.stringify({
    comm: { ct: 24 },
    recomPlaylist: {
      method: 'get_hot_recommend',
      param: { async: 1, cmd: 2 },
      module: 'playlist.HotRecommendServer'
    },
    focus: { module: 'music.musicHall.MusicHallPlatform', method: 'GetFocus', param: {} }
  })
  // 计算签名值
  const sign = getSecuritySign(data)
  // 随机数值
  const randomVal = getRandomVal('recommend')
  // 发送 get 请求
  const response = await get(BASE_URL, {
    sign,
    data,
    '-': randomVal
  })
  if (response.data.code === CODE_SUCCESS) {
    // 处理轮播图数据
    const focusList = response.data.focus.data.shelf.v_niche[0].v_card
    const sliders = []
    const jumpPrefixMap = {
      10002: 'https://y.qq.com/n/yqq/album/',
      10014: 'https://y.qq.com/n/yqq/playlist/',
      10012: 'https://y.qq.com/n/yqq/mv/v/'
    }
    // 最多获取 10 条数据
    const len = Math.min(focusList.length, 10)
    for (let i = 0; i < len; i++) {
      const item = focusList[i]
      const sliderItem = {}
      // 单个轮播图数据包括 id、pic、link 等字段
      sliderItem.id = item.id
      sliderItem.pic = item.cover
      if (jumpPrefixMap[item.jumptype]) {
        sliderItem.link = jumpPrefixMap[item.jumptype] + (item.subid || item.id) + '.html'
      } else if (item.jumptype === 3001) {
        sliderItem.link = item.id
      }
      sliders.push(sliderItem)
    }

    // 处理推荐歌单数据
    const albumList = response.data.recomPlaylist.data.v_hot
    const albums = []
    for (let i = 0; i < albumList.length; i++) {
      const item = albumList[i]
      const albumItem = {}
      // 推荐歌单数据包括 id、username、title、pic 等字段
      albumItem.id = item.content_id
      albumItem.username = item.username
      albumItem.title = item.title
      albumItem.pic = item.cover
      albums.push(albumItem)
    }

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        sliders,
        albums
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 歌手列表
router.get('/singer', async (ctx, next) => {
  const HOT_NAME = '热'
  const data = JSON.stringify({
    comm: { ct: 24, cv: 0 },
    singerList: {
      module: 'Music.SingerListServer',
      method: 'get_singer_list',
      param: { area: -100, sex: -100, genre: -100, index: -100, sin: 0, cur_page: 1 }
    }
  })
  const sign = getSecuritySign(data)
  const randomKey = getRandomVal('singer')
  const map = (singerList) => singerList.map((item) => ({
    id: item.singer_id,
    mid: item.singer_mid,
    name: item.singer_name,
    pic: item.singer_pic.replace(/\.webp$/, '.jpg').replace('150x150', '800x800')
  }))

  const response = await get(BASE_URL, {
    sign,
    data,
    '-': randomKey
  })
  if (response.data.code === CODE_SUCCESS) {
    // 处理歌手列表数据
    const singerList = response.data.singerList.data.singerlist
    // 构造歌手 Map 数据结构
    const singerMap = {
      hot: {
        title: HOT_NAME,
        list: map(singerList.slice(0, 10))
      }
    }
    singerList.forEach((item) => {
      // 把歌手名转成拼音
      const p = pinyin(item.singer_name)
      if (!p || !p.length) return
      // 获取歌手名拼音的首字母
      const key = p[0][0].slice(0, 1).toUpperCase()
      if (key) {
        if (!singerMap[key]) {
          singerMap[key] = {
            title: key,
            list: []
          }
        }
        // 每个字母下面会有多名歌手
        singerMap[key].list.push(map([item])[0])
      }
    })

    // 热门歌手
    const hot = []
    // 字母歌手
    const letter = []
    // 遍历处理 singerMap，让结果有序
    for (const key in singerMap) {
      const item = singerMap[key]
      if (item.title.match(/[a-zA-Z]/)) {
        letter.push(item)
      } else if (item.title === HOT_NAME) {
        hot.push(item)
      }
    }
    // 按字母顺序排序
    letter.sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0))

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        singers: [...hot, ...letter]
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 歌手详情 mid
router.get('/singer/detail', async (ctx, next) => {
  const data = JSON.stringify({
    comm: { ct: 24, cv: 0 },
    singerSongList: {
      method: 'GetSingerSongList',
      param: { order: 1, singerMid: ctx.query.mid, begin: 0, num: 100 },
      module: 'musichall.song_list_server'
    }
  })
  const sign = getSecuritySign(data)
  const randomKey = getRandomVal('singer-detail')

  const response = await get(BASE_URL, {
    sign,
    data,
    '-': randomKey
  })
  if (response.data.code === CODE_SUCCESS) {
    const list = response.data.singerSongList.data.songList
    // 歌单详情、榜单详情接口都有类似处理逻辑，固封装成函数
    const songList = handleSongList(list)

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        songs: songList
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 歌曲url
router.get('/song', async (ctx, next) => {
  const data = JSON.stringify({
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: getUid(),
        songmid: [ctx.query.mid],
        songtype: [0],
        uin: '0',
        loginflag: 0,
        platform: '23',
        h5to: 'speed'
      }
    },
    comm: {
      g_tk: TOKEN,
      uin: '0',
      format: 'json',
      platform: 'h5'
    }
  })
  const sign = getSecuritySign(data)
  const randomKey = getRandomVal('song')

  const response = await post(BASE_URL, data, {
    sign,
    '-': randomKey
  })
  if (response.data.code === CODE_SUCCESS) {
    const midInfo = response.data.req_0.data.midurlinfo
    const sip = response.data.req_0.data.sip
    const domain = sip[sip.length - 1]

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        songUrl: `${domain}${midInfo[0].purl}`
      }
    }
  } else {
    ctx.body = response.data
  }
})
router.get('/songs', async (ctx, next) => {
  const midGroup = []
  // 第三方接口只支持最多处理 100 条数据，所以如果超过 100 条数据，我们要把数据按每组 100 条切割，发送多个请求
  if (ctx.query.mids.length > 100) {
    for (let i = 0; i < ctx.query.mids.length; i += 100) {
      midGroup.push(ctx.query.mids.slice(i, i + 100))
    }
  } else {
    midGroup.push(ctx.query.mids)
  }

  const songUrl = {}

  // 发送 post 请求
  const process = (mid) => {
    const data = JSON.stringify({
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: getUid(),
          songmid: ctx.query.mids,
          songtype: new Array(ctx.query.mids.length).fill(0),
          uin: '0',
          loginflag: 0,
          platform: '23',
          h5to: 'speed'
        }
      },
      comm: {
        g_tk: TOKEN,
        uin: '0',
        format: 'json',
        platform: 'h5'
      }
    })
    const sign = getSecuritySign(data)
    const randomKey = getRandomVal('song')
    return post(BASE_URL, data, {
      sign,
      '-': randomKey
    }).then((response) => {
      if (response.data.code === CODE_SUCCESS) {
        const midInfo = response.data.req_0.data.midurlinfo
        const sip = response.data.req_0.data.sip
        const domain = sip[sip.length - 1]
        midInfo.forEach((info) => {
          songUrl[info.songmid] = `${domain}${info.purl}`
        })
      }
    })
  }

  // 构造多个 Promise 请求
  const requests = midGroup.map((mid) => process(mid))

  // 并行发送多个请求
  await Promise.all(requests)

  ctx.body = {
    code: CODE_SUCCESS,
    result: {
      songUrl
    }
  }
})

// 歌词
router.get('/lyric', async (ctx, next) => {
  const url = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg'

  const response = await get(url, {
    '-': 'MusicJsonCallback_lrc',
    pcachetime: new Date(),
    songmid: ctx.query.mid,
    g_tk_new_20200303: TOKEN
  })
  if (response.data.code === CODE_SUCCESS) {
    const lyric = Base64.decode(response.data.lyric)
    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        lyric
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 歌单专辑
router.get('/album', async (ctx, next) => {
  const data = JSON.stringify({
    req_0: {
      module: 'srf_diss_info.DissInfoServer',
      method: 'CgiGetDiss',
      param: {
        disstid: +ctx.query.id,
        onlysonglist: 1,
        song_begin: 0,
        song_num: 100
      }
    },
    comm: {
      g_tk: TOKEN,
      uin: '0',
      format: 'json',
      platform: 'h5'
    }
  })
  const sign = getSecuritySign(data)
  const randomKey = getRandomVal('album')
  const response = await post(BASE_URL, data, {
    sign,
    '-': randomKey
  })
  if (response.data.code === CODE_SUCCESS) {
    const list = response.data.req_0.data.songlist
    const songList = handleSongList(list)

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        songs: songList
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 排行榜
router.get('/toplist', async (ctx, next) => {
  const data = JSON.stringify({
    comm: { ct: 24 },
    toplist: { module: 'musicToplist.ToplistInfoServer', method: 'GetAll', param: {} }
  })
  const sign = getSecuritySign(data)
  const randomKey = getRandomVal('toplist')
  const response = await get(BASE_URL, {
    sign,
    data,
    '-': randomKey
  })
  if (response.data.code === CODE_SUCCESS) {
    const topList = []
    const group = response.data.toplist.data.group
    group.forEach((item) => {
      item.toplist.forEach((listItem) => {
        topList.push({
          id: listItem.topId,
          pic: listItem.frontPicUrl,
          name: listItem.title,
          period: listItem.period,
          songList: listItem.song.map((songItem) => {
            return {
              id: songItem.songId,
              singerName: songItem.singerName,
              songName: songItem.title
            }
          })
        })
      })
    })

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        topList
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 排行榜详情
router.get('/toplist/detail', async (ctx, next) => {
  const data = JSON.stringify({
    detail: {
      module: 'musicToplist.ToplistInfoServer',
      method: 'GetDetail',
      param: {
        topId: +ctx.query.id,
        offset: 0,
        num: 100,
        period: ctx.query.period
      }
    },
    comm: {
      ct: 24,
      cv: 0
    }
  })
  const sign = getSecuritySign(data)
  const randomKey = getRandomVal('toplist-detail')
  const response = await get(BASE_URL, {
    sign,
    data,
    '-': randomKey
  })
  if (response.data.code === CODE_SUCCESS) {
    const list = response.data.detail.data.songInfoList
    const songs = handleSongList(list)

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        songs
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 热门搜索
router.get('/search/hot', async (ctx, next) => {
  const url = 'https://c.y.qq.com/splcloud/fcgi-bin/gethotkey.fcg'
  const response = await get(url, {
    g_tk_new_20200303: TOKEN,
  })
  if (response.data.code === CODE_SUCCESS) {

    ctx.body = {
      code: CODE_SUCCESS,
      result: {
        hot: response.data.data.hotkey.map((key) => ({
          key: key.k,
          id: key.n
        }))
      }
    }
  } else {
    ctx.body = response.data
  }
})

// 搜索
router.get('/search', async (ctx, next) => {
  const url = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg'
  const data = {
    key: ctx.query.key,
    is_xml: 0,
    format: 'jsonp',
    platform: 'yqq',
  }
  const response = await get(url, data)
  if (response.data.code === CODE_SUCCESS) {

    ctx.body = {
      code: CODE_SUCCESS,
      result: response.data
    }
  } else {
    ctx.body = response.data
  }
})

module.exports = router
