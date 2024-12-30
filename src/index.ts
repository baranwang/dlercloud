import { URL } from "node:url";
import { z } from "zod";

const dlerFetch = <T,>(urlPath: string, body: any = {}): Promise<T> => fetch(`https://dler.cloud${urlPath}`, {
	method: 'POST',
	body: JSON.stringify(body),
	headers: {
		'Content-Type': 'application/json',
	},
}).then((res) => res.json())

const paramsSchema = z.object({
	email: z.string({ message: 'email is required' }),
	passwd: z.string({ message: 'password is required' }),
	type: z.enum(['smart', 'ss', 'vmess', 'trojan']).optional().default('smart'),
})

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url)

		const email = request.headers.get('X-Dler-Email') || url.searchParams.get('email')
		const passwd = request.headers.get('X-Dler-Password') || url.searchParams.get('passwd')

		const params = paramsSchema.safeParse({ email, passwd, type: url.searchParams.get('type') ?? undefined })

		if (!params.success) {
			return new Response(params.error.errors[0].message, { status: 400 })
		}

		const loginResp = await dlerFetch<{ ret: number; data: { token: string }, msg: string }>('/api/v1/login', {
			email: params.data.email,
			passwd: params.data.passwd,
			token_expire: 1
		})

		if (loginResp.ret !== 200) {
			return new Response(loginResp.msg, { status: loginResp.ret })
		}

		const managedResp = await dlerFetch<{ [key: string]: string }>('/api/v1/managed/clash', { access_token: loginResp.data.token })

		const resp = await fetch(managedResp[params.data.type])

		await dlerFetch('/api/v1/logout', { access_token: loginResp.data.token })

		return new Response(await resp.text(), {
			headers: {
				'subscription-userinfo': resp.headers.get('subscription-userinfo') || '',
			}
		});
	},
} satisfies ExportedHandler<Env>;
