import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_MAIL_PASS,
  },
});

const sendMail = async (mailOptions) => {
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

export const sendOtpEmail = async (email, otp, subject) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject: subject,
      html: `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
               <p>This OTP is required to verify your email address and ensure the security of your account. Please enter this code in the designated field on the verification page. For added security, this OTP is valid for a limited time only.</p>
               <p>If you did not request this verification, you can safely ignore this email.</p>
               <p>Best regards,<br>Trading Bot Team</p>`,
    };

    await sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false };
  }
};
