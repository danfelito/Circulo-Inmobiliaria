import 'dotenv/config';

const renderUrl = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '';

export const config = {
  port: Number(process.env.PORT ?? 10000), nodeEnv: process.env.NODE_ENV ?? 'development', clientOrigin: process.env.CLIENT_ORIGIN || renderUrl || 'http://localhost:5173', appBaseUrl: process.env.APP_BASE_URL || renderUrl || 'http://localhost:10000', supabaseUrl: process.env.SUPABASE_URL ?? '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', openaiApiKey: process.env.OPENAI_API_KEY ?? '', openaiModel: process.env.OPENAI_MODEL ?? 'gpt-5.6', resendApiKey: process.env.RESEND_API_KEY ?? '', emailFrom: process.env.EMAIL_FROM ?? 'Círculo Internacional <onboarding@resend.dev>', advisorEmail: process.env.ADVISOR_EMAIL ?? 'patyestr@hotmail.com', adminLogin: process.env.ADMIN_LOGIN ?? 'circulointernacionalveracruz1@gmail.com', adminPassword: process.env.ADMIN_PASSWORD ?? '', adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? '$2b$12$QoNtflnxNQirKwYrCDc.9.RRW1FDsoLuspJowOelRX3J902Wnmvaq', sessionSecret: process.env.SESSION_SECRET ?? 'development-only-secret-change-me',
};
export const isProduction = config.nodeEnv === 'production';