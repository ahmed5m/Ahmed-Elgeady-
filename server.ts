import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// Initialize Firebase client SDK on the server
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Admin SDK for user management and database access
try {
  admin.initializeApp();
} catch (e) {
  console.warn("Firebase Admin failed to initialize with default credentials. User management might be limited.");
}

const dbAdmin = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // System Broadcast
  app.post("/api/system/broadcast", async (req, res) => {
    const { message, sender } = req.body;
    // Log broadcast to activity and broadcast collection
    res.json({ success: true, message: "Broadcast signal transmitted." });
  });

  // System Bootstrap: Setup Admin Accounts with Password
  app.post("/api/system/bootstrap", async (req, res) => {
    const adminEmails = ["ahmedeljeady@gmail.com", "ahmedjp070@gmail.com"];
    const defaultPassword = "admin123";
    const results = [];

    try {
      for (const email of adminEmails) {
        try {
          let userRecord;
          try {
            userRecord = await admin.auth().getUserByEmail(email);
            // Update password if exists
            await admin.auth().updateUser(userRecord.uid, { password: defaultPassword });
            results.push({ email, status: "updated", uid: userRecord.uid });
          } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
              // Create user
              userRecord = await admin.auth().createUser({
                email,
                password: defaultPassword,
                displayName: "System Administrator"
              });
              results.push({ email, status: "created", uid: userRecord.uid });
            } else {
              throw e;
            }
          }
        } catch (innerError: any) {
          results.push({ email, status: "failed", error: innerError.message });
        }
      }
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Nodemailer transporter (Lazy initialization recommended)
  const getTransporter = () => {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.warn("SMTP credentials missing. Emails will not be sent.");
      return null;
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/inquiry", async (req, res) => {
    const { name, email, phone, description } = req.body;

    if (!name || !email || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // 1. Save to Firestore using Admin SDK to bypass rules
      await dbAdmin.collection("inquiries").add({
        name,
        email,
        phone: phone || null,
        description,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 1.1 Create Notification for Admin
      await dbAdmin.collection("notifications").add({
        role: 'admin',
        title: "New Inquiry Received",
        message: `New inquiry from ${name}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
        read: false,
        type: 'inquiry',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 2. Send Emails
      const transporter = getTransporter();
      if (transporter) {
        const notificationEmail = process.env.NOTIFICATION_EMAIL || "ahmedeljeady@gmail.com";

        // To Ahmed (Notification)
        await transporter.sendMail({
          from: `"Architectural Engine" <${process.env.SMTP_USER}>`,
          to: notificationEmail,
          subject: `New Project Inquiry: ${name}`,
          text: `You have received a new inquiry.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n\nProject Brief:\n${description}`,
          html: `
            <div style="font-family: serif; color: #1a1a1a; padding: 40px; border: 1px solid #c5a358;">
              <h2 style="color: #c5a358; border-bottom: 1px solid #eee; padding-bottom: 20px;">New Inquiry Received</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
              <h3 style="margin-top: 30px;">Project Brief:</h3>
              <p style="background: #f9f9f9; padding: 20px; border-left: 4px solid #c5a358; white-space: pre-wrap;">${description}</p>
            </div>
          `
        });

        // To Inquirer (Confirmation)
        await transporter.sendMail({
          from: `"Ahmed El-Jaidi" <${process.env.SMTP_USER}>`,
          to: email,
          subject: `Thank you for reaching out, ${name}`,
          text: `Hi ${name},\n\nThank you for sharing your project vision. I have received your inquiry and will review the requirements shortly.\n\nBest regards,\nAhmed El-Jaidi`,
          html: `
            <div style="font-family: serif; color: #1a1a1a; padding: 40px; text-align: center; border: 1px solid #c5a358;">
              <h1 style="color: #c5a358;">Architecting the Future</h1>
              <p style="font-size: 18px; margin-top: 20px;">Hello ${name},</p>
              <p style="font-size: 16px; color: #555;">Thank you for sharing your project vision with me. I have successfully received your inquiry and I'm currently reviewing the technical requirements.</p>
              <p style="margin-top: 40px; color: #c5a358; font-weight: bold;">I will be in touch shortly to discuss the lifecycle of our collaboration.</p>
              <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999;">Ahmed Mohamed El-Jaidi<br/>Senior Backend Architect</p>
              </div>
            </div>
          `
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Inquiry error:", error);
      res.status(500).json({ error: "Failed to process inquiry" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
