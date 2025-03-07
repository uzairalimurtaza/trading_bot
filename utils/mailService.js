import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_MAIL_PASS,
  },
});

export const sendMail = async (mailOptions) => {
  try {
    transporter.sendMail(mailOptions, function (error, info) {
      console.log(mailOptions);
      if (error) {
        console.log("Error email sent:", error);
      } else {
        console.log("Email sent error:", info.response);
      }
    });
  } catch (err) {
    console.log("error while sending mail");
  }
};
