import { createServer } from 'node:http';
import { seed } from './db.ts';
import { handle, route } from './http.ts';
import { otpProvider } from './otp.ts';
import './routes-app.ts';
import './routes-admin.ts';
import './routes-auto-deposit.ts';

seed();

// Opening the API in a browser shows that it is up and where the real pages are.
const status = () => ({
  status: 'Kalyan API is running',
  app: 'http://localhost:5174',
  admin: 'http://localhost:5180',
});
route('GET', '/', status);
route('GET', '/api/health', status);

const port = Number(process.env.PORT ?? 4100);
export const server = createServer(handle);

if (process.env.NODE_ENV !== 'test') {
  // BIND_HOST lets the combined dev runner keep internal services off the public interface.
  server.listen(port, process.env.BIND_HOST || '0.0.0.0', () => {
    console.log(`API running on http://localhost:${port}`);
    console.log(otpProvider.demo
      ? 'OTP: test mode (no SMS, code 123456). Add MC_CUSTOMER_ID and MC_PASSWORD to server/.env for real SMS.'
      : 'OTP: real SMS via Message Central');
  });
}
