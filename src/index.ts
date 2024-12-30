import { URL } from "node:url";

const dlerFetch = <T,>(urlPath: string, body: any = {}): Promise<T> => fetch(`https://dler.cloud${urlPath}`, {
	method: 'POST',
	body: JSON.stringify(body),
	headers: {
		'Content-Type': 'application/json',
	},
}).then((res) => res.json())

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url)

		const email = request.headers.get('X-Dler-Email') || url.searchParams.get('email')
		const passwd = request.headers.get('X-Dler-Password') || url.searchParams.get('passwd')

		if (!email || !passwd) {
			return new Response('email and password are required', { status: 400 })
		}

		const loginResp = await dlerFetch<{ ret: number; data: { token: string }, msg: string }>('/api/v1/login', {
			email,
			passwd,
			token_expire: 1
		})

		if (loginResp.ret !== 200) {
			return new Response(loginResp.msg, { status: loginResp.ret })
		}

		const managedResp = await dlerFetch<{ smart: string }>('/api/v1/managed/clash', { access_token: loginResp.data.token })

		const resp = await fetch(managedResp.smart)

		await dlerFetch('/api/v1/logout', { access_token: loginResp.data.token })

		return new Response(await resp.text(), {
			headers: {
				'subscription-userinfo': resp.headers.get('subscription-userinfo') || '',
			}
		});
	},
} satisfies ExportedHandler<Env>;
