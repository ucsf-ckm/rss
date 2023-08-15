import fs from 'node:fs/promises'
import fetch from 'node-fetch'
import xmldom from '@xmldom/xmldom'

await fs.unlink('docs/sample.html')
await fs.unlink('docs/events.json')

const feeds = [
  { label: 'NEWS: Latest Library News (all)', url: 'https://www.library.ucsf.edu/feed', limit: 10 },
  { label: 'EVENTS: Upcoming Events from the Library', url: 'https://calendars.library.ucsf.edu/1.1/events?cal_id=928&days=365&limit=500', limit: 500, json: true },
  { label: 'NEWS: Latest news about Makers Lab', url: 'https://www.library.ucsf.edu/topic/makers-lab/feed', limit: 5 },
  { label: 'EVENTS: Makers Lab', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=25201', limit: 15 },
  { label: 'NEWS: Latest news about learning technology', url: 'https://www.library.ucsf.edu/topic/ed-tech/feed', limit: 5 },
  { label: 'EVENTS: Learning Technology', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=958', limit: 15 },
  { label: 'NEWS: Latest news about archives and special Collections', url: 'https://www.library.ucsf.edu/topic/archives-special-collections/feed/', limit: 5 },
  { label: 'EVENTS: Archives and Special Collections', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=6331', limit: 15 },
  { label: 'NEWS: Latest news about literature and research', url: 'https://www.library.ucsf.edu/topic/education-research/feed', limit: 5 },
  { label: 'EVENTS: Education and Research', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=37580', limit: 15 },
  { label: 'NEWS: Latest news about data science', url: 'https://www.library.ucsf.edu/topic/data-science-initiative/feed', limit: 5 },
  { label: 'EVENTS: Data Science', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=27094', limit: 25 },
  { label: 'NEWS: Latest news about scholarly communication', url: 'https://www.library.ucsf.edu/topic/scholarly-communication/feed', limit: 5 },
  { label: 'EVENTS: Upcoming Events from the ZSFG', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=29165', limit: 15 }
]

async function main (url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  const contentType = await res.headers.get('content-type')

  if (contentType.includes('rss+xml')) {
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
  } else {
    return res.json()
  }
}

await fs.writeFile(
  'docs/sample.html',
  '<!doctype html>\n<title>Newsletter contents</title>\n',
  { flag: 'a' }
)
await fs.writeFile(
  'docs/sample.html',
  '<a href="https://github.com/ucsf-ckm/rss/actions/workflows/update.yml"><img alt="Update job status" src="https://github.com/ucsf-ckm/rss/actions/workflows/update.yml/badge.svg"></a>\n',
  { flag: 'a' }
);

// TODO: assert that json.channel.children exists and is an array for RSS, same for json.events for API
// TODO: assert that link exists and is a string.
// TODO: catch errors

(async () => {
  const clientSecret = process.env.TOKEN
  const oauth = await fetch('https://calendars.library.ucsf.edu/1.1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `client_id=834&client_secret=${clientSecret}&grant_type=client_credentials`
  })

  const oauthJson = await oauth.json()
  const token = oauthJson.access_token

  for (const feed of feeds) {
    const json = await main(feed.url, token)
    await fs.writeFile('docs/sample.html', `<hr>${feed.label}<br><br>\n`, { flag: 'a' })
    if (json.channel) {
      const children = json.channel.children
      // TODO: This can throw. Better error handling or checking needed.
      const data = children.filter(el => el.title && !el.height)
      const items = data.slice(0, feed.limit)
      const html = items.map(el => {
        if (el['libcal:date']) {
          // Handle event listing.
          const [year, monthNum, dayNum] = el['libcal:date'].content.split('-')
          const month = new Date(year, monthNum - 1, dayNum).toLocaleString('en-US', { month: 'long' })
          return `${month} ${dayNum}<br><a href="${el.link.content}">${el.title.content}</a><br><br>`
        } else {
          // Handle news item.
          return `<a href="${el.link.content}">${el.title.content}</a><br><br>`
        }
      })
      await fs.writeFile('docs/sample.html', html.join('\n'), { flag: 'a' })
    } else if (json.events) {
      const events = json.events
      // TODO: This can throw. Better error handling or checking needed.
      const html = events.map(el => {
        // TODO: move this to a helper function, it's same as above
        const [year, monthNum, dayNum] = el.start.split(/[^\d]/)
        const month = new Date(year, monthNum - 1, dayNum).toLocaleString('en-US', { month: 'long' })
        return `${month} ${dayNum}<br><a href="${el.url.public}">${el.title}</a><br><br>`
      })
      await fs.writeFile('docs/sample.html', html.join('\n'), { flag: 'a' })
      if (feed.json) {
        await fs.writeFile('docs/events.json', JSON.stringify(events), { flag: 'a' })
      }
    } else {
      const errorMsg = json.error_description || 'Unknown error'
      throw new Error(errorMsg)
    }
  }
})()
