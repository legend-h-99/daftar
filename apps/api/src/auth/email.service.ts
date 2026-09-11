import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM') ?? 'Daftar <onboarding@resend.dev>';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Email service ready via Resend');
    } else {
      this.logger.warn('RESEND_API_KEY not set — verification codes will only be logged.');
    }
  }

  async sendVerificationEmail(email: string, code: string, name?: string | null) {
    const greeting = name ? `مرحباً ${name}` : 'مرحباً';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr>
          <td style="background:#15803d;padding:32px;text-align:center;">
            <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:12px;line-height:56px;font-size:28px;font-weight:900;color:#fff;">د</div>
            <div style="color:#fff;font-size:22px;font-weight:800;margin-top:12px;">دفتر</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">نظام إدارة الأعمال</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${greeting}،</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.7;">
              شكراً لتسجيلك في <strong style="color:#111827;">دفتر</strong>.<br>
              استخدم رمز التأكيد التالي لتفعيل بريدك الإلكتروني.
            </p>
            <div style="direction:ltr;text-align:center;letter-spacing:8px;font-size:32px;font-weight:800;color:#111827;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:18px 12px;margin:8px 0 24px;">
              ${code}
            </div>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.7;text-align:center;">
              الرمز صالح لمدة 15 دقيقة فقط.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              إذا لم تطلب إنشاء حساب، تجاهل هذا البريد بأمان.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    if (!this.resend) {
      this.logger.warn(`[DEV] Verification code for ${email}: ${code}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'رمز تأكيد البريد الإلكتروني — دفتر',
      html,
    });

    if (error) {
      this.logger.error(`Resend error for ${email}:`, error);
      throw new Error(error.message);
    }

    this.logger.log(`Verification email sent to ${email}`);
  }
}
