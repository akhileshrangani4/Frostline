This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Muse concierge demo

Set `TYPESAFE_API_KEY` and `EXA_API_KEY` in `.env.local`. Set
`NEXT_PUBLIC_VAPI_PUBLIC_KEY` if you also want to place browser voice calls.
Run `pnpm dev`, open the room page, and expose the app through an HTTPS
tunnel. Add the tunnel's `/api/mcp/mcp` URL as a Streamable HTTP connector
in Muse. Try asking it to find a restaurant near the Palace Hotel.

`ask_concierge` sends the request to Jev and searches Exa when it detects a
nearby-place request. The room page receives the same results on `/api/live`.
Keep the live room display and its event stream local.
The live feed uses memory in a single Next.js process. A multi-instance
deployment needs a shared store and a way to deliver updates across instances.

Set `CONCIERGE_PUBLIC_URL` to the public HTTPS origin to include a visual
results link in the MCP answer. Forward `/share/<id>` and `/_next/static/*`
through the tunnel alongside the MCP path. Each link shows just that request's
results for up to one hour while the demo process is running.
