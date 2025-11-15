const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to, subject, html){
  try{
    const info = await transporter.sendMail({ 
      from: `"Bot System" <${process.env.SMTP_USER}>`, 
      to, subject, html 
    });
    console.log("Email terkirim:", info.messageId);
    return info;
  } catch(err){
    console.error("Gagal kirim email:", err);
    throw err;
  }
}

module.exports = { sendEmail };