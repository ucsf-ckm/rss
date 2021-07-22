'use strict'

// TODO: accept URL as a parameter so we can add things in
const urlBase = 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=27094'

const fetch = require('node-fetch')
const xmldom = require('xmldom')

async function main (url) {
  const res = await fetch(url)

  const body = await res.text()

  const xml = new xmldom.DOMParser().parseFromString(body, 'text/xml')

  // Inspiration from https://stackoverflow.com/a/58991998/436641
  const xml2json = xml => {
    const el = xml.nodeType === 9 ? xml.documentElement : xml

    const h = {}
    h.content = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('')
    h.children = Array.from(el.childNodes).filter(n => n.nodeType === 1).map(c => {
      const r = xml2json(c)
      h[c.nodeName] = h[c.nodeName] || r
      return r
    })
    return h
  }
  return xml2json(xml)
}

// TODO: assert that json.channel.children exists and is an array.
// TODO: assert that link and libcal:date exist
// TODO: catch errors

main(urlBase)
  .then(json => json.channel.children)
  .then(data => data.filter(el => el.title))
  .then(data => data.slice(0, 3)) // Limit to first 3 items
  .then(data => data.map(el => {
    const [year, monthNum, dayNum] = el['libcal:date'].content.split('-')
    const month = new Date(year, monthNum - 1, dayNum).toLocaleString('en-US', { month: 'long' })
    return `${month} ${dayNum}<br><a href="${el.link.content}">${el.title.content}</a><br><br>`
  }))
  .then(html => html.join('\n'))
  .then(foo => console.log(foo))
