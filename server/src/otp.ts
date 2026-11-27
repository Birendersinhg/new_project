// Sends and checks registration OTPs.
// With MC_CUSTOMER_ID + MC_PASSWORD set, real SMS goes out through Message Central VerifyNow
// (https://www.messagecentral.com, free test credits on signup). Without them, or with OTP_MODE=fixed, test mode: no SMS, code 123456.

export const DEMO_OTP = '123456';
const BASE = 'https://cpaas.messagecentral.com';
const OTP_LENGTH = 6;

export class OtpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface OtpProvider {
  /** True when no SMS is sent and the fixed test code is used. */
  demo: boolean;
  /** Sends an OTP; returns a reference needed to verify it later. */
  send(mobile: string): Promise<string>;
  /** Checks the code; false for a wrong code, throws for expired/other errors. */
  verify(mobile: string, code: string, ref: string): Promise<boolean>;
}

const demoProvider: OtpProvider = {
  demo: true,
  send: async () => DEMO_OTP,
  verify: async (_mobile, code, ref) => code === ref,
};

interface McResponse { responseCode?: number | string; message?: string; data?: { verificationId?: string | number; verificationStatus?: string; responseCode?: number | string; errorMessage?: string } }

/** Either the dashboard's Auth Token (used as-is) or the account password (exchanged for a token). */
function messageCentral(customerId: string, password: string | undefined, staticToken?: string): OtpProvider {
  let token: string | null = staticToken ?? null;

  async function getToken(): Promise<string> {
    if (token) return token;
    if (!password) throw new OtpError(502, 'SMS service token was rejected. Generate a new Auth Token in Message Central and update MC_AUTH_TOKEN.');
    const url = `${BASE}/auth/v1/authentication/token?customerId=${encodeURIComponent(customerId)}`
      + `&key=${encodeURIComponent(Buffer.from(password).toString('base64'))}&scope=NEW&country=91`;
    const res = await call(url, 'GET');
    const t = (res as { token?: string }).token;
    if (!t) throw new OtpError(502, 'SMS service login failed. Check MC_CUSTOMER_ID and MC_PASSWORD.');
    token = t;
    return t;
  }

  async function call(url: string, method: string, auth?: string): Promise<McResponse & Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(url, { method, headers: { accept: '*/*', ...(auth ? { authToken: auth } : {}) } });
    } catch {
      throw new OtpError(502, 'Could not reach the SMS service. Please try again.');
    }
    // A rejected token is fetched once more; anything else is reported as-is.
    if (res.status === 401 && auth) {
      token = null;
      return call(url, method, await getToken());
    }
    return (await res.json().catch(() => ({}))) as McResponse & Record<string, unknown>;
  }

  // The status may come as a number or a string, at the top level or inside `data`.
  const code = (r: McResponse) => Number(r.responseCode ?? r.data?.responseCode);

  return {
    demo: false,
    async send(mobile) {
      const r = await call(`${BASE}/verification/v3/send?countryCode=91&customerId=${encodeURIComponent(customerId)}`
        + `&flowType=SMS&mobileNumber=${mobile}&otpLength=${OTP_LENGTH}`, 'POST', await getToken());
      if (code(r) === 200 && r.data?.verificationId) return String(r.data.verificationId);
      if (code(r) === 506) throw new OtpError(429, 'An OTP was just sent. Please wait a minute before requesting again.');
      if (code(r) === 800) throw new OtpError(429, 'Too many OTP requests. Please try again later.');
      throw new OtpError(502, `Could not send OTP${r.data?.errorMessage || r.message ? `: ${r.data?.errorMessage ?? r.message}` : ''}`);
    },
    async verify(mobile, otp, ref) {
      const r = await call(`${BASE}/verification/v3/validateOtp?countryCode=91&mobileNumber=${mobile}`
        + `&verificationId=${encodeURIComponent(ref)}&customerId=${encodeURIComponent(customerId)}&code=${encodeURIComponent(otp)}&flowType=SMS`,
      'GET', await getToken());
      if (code(r) === 200 && r.data?.verificationStatus === 'VERIFICATION_COMPLETED') return true;
      if (code(r) === 702 || code(r) === 700) return false;
      if (code(r) === 705) throw new OtpError(400, 'OTP expired. Please request a new one.');
      if (code(r) === 703) throw new OtpError(400, 'This OTP was already used. Please request a new one.');
      if (code(r) === 800) throw new OtpError(429, 'Too many attempts. Please request a new OTP.');
      throw new OtpError(502, 'Could not verify OTP. Please try again.');
    },
  };
}

/** Picks the provider from the environment once, at startup. */
export function createOtpProvider(env: NodeJS.ProcessEnv = process.env): OtpProvider {
  const { MC_CUSTOMER_ID, MC_PASSWORD, MC_AUTH_TOKEN, OTP_MODE } = env;
  // OTP_MODE=fixed: no SMS is sent and the code is always 123456 (saves SMS credits); the SMS keys can stay in .env.
  if (OTP_MODE === 'fixed') return demoProvider;
  if (!MC_CUSTOMER_ID || (!MC_PASSWORD && !MC_AUTH_TOKEN)) return demoProvider;
  return messageCentral(MC_CUSTOMER_ID, MC_PASSWORD || undefined, MC_AUTH_TOKEN || undefined);
}

export let otpProvider = createOtpProvider();
/** Tests swap the provider. */
export const setOtpProvider = (p: OtpProvider) => { otpProvider = p; };
