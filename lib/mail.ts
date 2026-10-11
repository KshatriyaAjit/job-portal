// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// // Helper to handle Free Tier restrictions
// // In production, you would send to 'toEmail'. 
// // In development/free tier, we must send to your verified email.
// const DEVELOPER_EMAIL = "kshatriyakavisingh@gmail.com"; // Your verified Resend email

// export async function sendApplicationEmail(
//   toEmail: string,
//   candidateName: string,
//   jobTitle: string,
//   resumeUrl: string
// ) {
//   await resend.emails.send({
//     from: "onboarding@resend.dev",
//     to: DEVELOPER_EMAIL, // In Prod: use 'toEmail'
//     subject: `[For Recruiter] New Applicant: ${candidateName}`,
//     html: `
//       <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: #2563eb;">New Application Received! 🚀</h2>
//         <p><strong>Job:</strong> ${jobTitle}</p>
//         <p><strong>Candidate:</strong> ${candidateName}</p>
//         <p>A new candidate has applied to your position. Review their profile below:</p>
//         <br />
//         <a href="${resumeUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
//           View Resume PDF
//         </a>
//         <p style="margin-top: 24px; font-size: 12px; color: #666;">
//           (Dev Note: This email is intended for ${toEmail})
//         </p>
//       </div>
//     `,
//   });
// }

// export async function sendStatusUpdateEmail(
//   toEmail: string,
//   candidateName: string,
//   jobTitle: string,
//   status: string
// ) {
//   // Color code the status
//   const color = status === "accepted" ? "#16a34a" : status === "rejected" ? "#dc2626" : "#2563eb";
//   const statusText = status.charAt(0).toUpperCase() + status.slice(1);

//   await resend.emails.send({
//     from: "onboarding@resend.dev",
//     to: DEVELOPER_EMAIL, // In Prod: use 'toEmail'
//     subject: `[For Candidate] Application Update: ${statusText}`,
//     html: `
//       <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${color};">Application Status Update</h2>
//         <p>Hi ${candidateName},</p>
//         <p>There has been an update to your application for <strong>${jobTitle}</strong>.</p>
        
//         <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
//           <p style="margin: 0; font-size: 14px; color: #666;">Current Status:</p>
//           <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: ${color};">
//             ${statusText}
//           </p>
//         </div>

//         <p>Log in to your dashboard to view more details.</p>
//         <p style="margin-top: 24px; font-size: 12px; color: #666;">
//           (Dev Note: This email is intended for ${toEmail})
//         </p>
//       </div>
//     `,
//   });
// }


import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ FREE TIER RULE: All emails must go here.
const DEVELOPER_EMAIL = "kshatriyakavisingh@gmail.com"; 

export async function sendApplicationEmail(
  toEmail: string,
  candidateName: string,
  jobTitle: string,
  resumeUrl: string
) {
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: DEVELOPER_EMAIL, 
    subject: `[For Recruiter] New Applicant: ${candidateName}`,
    html: `
      <h2>New Application Received! 🚀</h2>
      <p><strong>Job:</strong> ${jobTitle}</p>
      <p><strong>Candidate:</strong> ${candidateName}</p>
      <a href="${resumeUrl}">View Resume</a>
      <p style="color: #666; font-size: 12px;">(Sent to Dev: intended for ${toEmail})</p>
    `,
  });
}

export async function sendStatusUpdateEmail(
  toEmail: string,
  candidateName: string,
  jobTitle: string,
  status: string
) {
  const color = status === "accepted" ? "#16a34a" : status === "rejected" ? "#dc2626" : "#2563eb";
  const statusText = status.charAt(0).toUpperCase() + status.slice(1);

  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: DEVELOPER_EMAIL, // 👈 Redirects candidate email to YOU
    subject: `[For Candidate] Application Update: ${statusText}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${color};">Application Status Update</h2>
        <p>Hi ${candidateName},</p>
        <p>Your application for <strong>${jobTitle}</strong> has been updated.</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">New Status:</p>
          <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: ${color};">
            ${statusText}
          </p>
        </div>

        <p style="color: #666; font-size: 12px;">
          (Dev Note: This email was intended for the candidate: ${toEmail})
        </p>
      </div>
    `,
  });
}