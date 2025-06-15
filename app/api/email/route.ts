import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { to, subject, html, pdfBase64, pdfFileName, pdfBuffer } = await req.json();

  if (!to || !subject || !html || (!pdfBase64 && !pdfBuffer)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const resentApiKey = process.env.RESEND_API_KEY;
  const from = 'ProofPay <onboarding@resend.dev>';

  // 兼容前端传base64或buffer
  let pdfContent = pdfBase64;
  if (!pdfContent && pdfBuffer) {
    pdfContent = Buffer.from(pdfBuffer.data).toString('base64');
  }

  const data = {
    from,
    to,
    subject,
    html,
    attachments: [
      {
        content: pdfContent,
        filename: pdfFileName || 'invoice.pdf',
        type: 'application/pdf',
        disposition: 'attachment',
        base64: true,
      },
    ],
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resentApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch (e) {
      error = await response.text();
    }
    return NextResponse.json({ error }, { status: response.status });
  }

  return NextResponse.json({ success: true });
} 