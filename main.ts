import { Application, Router } from './deps.ts'
// import { config } from './deps.ts'

const env = { ...Deno.env.toObject() } // ...config(),

const app = new Application() // { logErrors: false }
const port = parseInt(env['PORT'] || '8000')

const router = new Router()

const followers: { [address: string]: WebSocket[] } = {}

router.post('/new-event', async (ctx) => {
  const body = await ctx.request.body({ type: 'json' }).value
  const { address, message } = body as { address: string; message: string }
  const stableAddress = address.toLowerCase()
  console.log('Received new event for', stableAddress, 'with message:', message)

  if (followers[stableAddress] && Array.isArray(followers[stableAddress])) {
    for (const ws of followers[stableAddress]) {
      // console.log(ws.readyState, ws)
      ws.send(JSON.stringify({ message }))
      // console.log('Sent for', ws.url)
    }
  } else {
    console.log('No subscribers for', stableAddress)
  }

  ctx.response.body = { status: 'ok' }
})

// let count = 0
// setInterval(() => {
//   const stableAddress = '0x39f4cfdc7a708a0a649bcada778eb77b61dce5d5'
//   if (followers[stableAddress] && Array.isArray(followers[stableAddress])) {
//     for (const ws of followers[stableAddress]) {
//       console.log(ws.readyState, ws)
//       ws.send(JSON.stringify({ message: `Event Relay: Hello there ${count}` }))
//       count++
//       console.log('Sent for', ws.url)
//     }
//   } else {
//     console.log('No subscribers for', stableAddress)
//   }
// }, 5000)

router.get('/follow', (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501)
  }

  const address = ctx.request.url.searchParams.get('address')?.toLowerCase()
  if (address) {
    const ws = ctx.upgrade()
    if (address in followers) {
      followers[address].push(ws)
    } else {
      followers[address] = [ws]
    }

    ws.onopen = () => {
      console.log('Connected to follower for', address)
      ws.send(JSON.stringify({ message: `Event Relay: Hi! You have subscribed for events for ${address}` }))
    }

    ws.onclose = () => {
      console.log('Disconncted from follower for', address)
      followers[address] = followers[address].filter((e) => e !== ws)
    }
  }
})

app.use(router.routes())
app.use(router.allowedMethods())

console.log(`Message Relay server is running at http://localhost:${port}`)
await app.listen({ port: port })
