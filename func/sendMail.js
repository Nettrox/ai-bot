import nodemailer from "nodemailer";
import "dotenv/config";

export async function sendMail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MY_EMAIL,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MY_EMAIL,
    to,
    subject,
    text,
  });
}