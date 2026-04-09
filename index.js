import fs from 'node:fs/promises'
import fetch from 'node-fetch'
import xmldom from '@xmldom/xmldom'

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
  { label: 'NEWS: Latest news about data science', url: 'https://www.library.ucsf.edu/topic/data-science/feed', limit: 5 },
  { label: 'EVENTS: Data Science', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=27094', limit: 25 },
  { label: 'NEWS: Latest news about scholarly communication', url: 'https://www.library.ucsf.edu/topic/scholarly-communication/feed', limit: 5 },
  { label: 'EVENTS: Upcoming Events from the ZSFG', url: 'https://calendars.library.ucsf.edu/rss.php?m=cat&iid=138&cid=928&cat=29165', limit: 15 }
]

async function main (url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  const contentType = res.headers.get('content-type')

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
    if (json.events) {
      const events = json.events
      // TODO: This can throw. Better error handling or checking needed.
      if (feed.json) {
        const rss = events.map((el) => {
          el.location = el.location.name
          el.campus = el.campus.name
          return el
        })
        await fs.writeFile('docs/events.json', JSON.stringify(rss), { flag: 'a' })
      }
    }
  }
})()
