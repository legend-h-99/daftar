import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM') ?? 'Daftar <onboarding@resend.dev>';
    this.appUrl = config.get<string>('APP_URL') ?? 'https://daftar-ead.pages.dev';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Email service ready via Resend');
    } else {
      this.logger.warn('RESEND_API_KEY not set — verification links will only be logged.');
    }
  }

  async sendVerificationEmail(email: string, token: string, name?: string | null) {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    const greeting = name ? `مرحباً ${name}` : 'مرحباً';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#15803d;padding:32px;text-align:center;">
            <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:12px;line-height:56px;font-size:28px;font-weight:900;color:#fff;">د</div>
            <div style="color:#fff;font-size:22px;font-weight:800;margin-top:12px;">دفتر</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">نظام إدارة الأعمال</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${greeting}،</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.7;">
              شكراً لتسجيلك في <strong style="color:#111827;">دفتر</strong>.<br>
              اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${link}"
                     style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:700;font-size:16px;">
                    تأكيد البريد الإلكتروني
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
              أو انسخ هذا الرابط وألصقه في المتصفح:
            </p>
            <p style="margin:0;background:#f3f4f6;border-radius:8px;padding:10px 12px;font-size:11px;color:#6b7280;word-break:break-all;text-align:left;direction:ltr;">
              ${link}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              هذا الرابط صالح لمدة 24 ساعة.<br>
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
      this.logger.warn(`[DEV] Verification link for ${email}: ${link}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'تأكيد البريد الإلكتروني — دفتر',
      html,
    });

    if (error) {
      this.logger.error(`Resend error for ${email}:`, error);
      throw new Error(error.message);
    }

    this.logger.log(`Verification email sent to ${email}`);
  }
}
