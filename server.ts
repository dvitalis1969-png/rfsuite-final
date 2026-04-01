import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import archiver from "archiver";
import Stripe from "stripe";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getLinkPreview } from "link-preview-js";
import { UK_TV_CHANNELS, US_TV_CHANNELS } from "./constants.js";
import nodemailer from 'nodemailer';

const calculateReceivedPowerDbm = (erpKw: number, distanceKm: number, frequencyMhz: number): number => {
  if (distanceKm <= 0.001) return 10 * Math.log10(erpKw * 1000);
  const txPowerDbm = 10 * Math.log10(erpKw * 1000);
  const pathLossDb = 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMhz) + 32.44;
  return txPowerDbm - pathLossDb;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization for Stripe and Firebase Admin
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    let key = process.env.STRIPE_SECRET_KEY;
    
    if (key) {
      console.log("✅ Stripe initialized from environment variable (starts with: " + key.substring(0, 7) + "...)");
    } else {
      // Try to load from local stripe-config.json if it exists
      const stripePath = path.join(process.cwd(), 'stripe-config.json');
      if (fs.existsSync(stripePath)) {
        try {
          const stripeConfig = JSON.parse(fs.readFileSync(stripePath, 'utf8'));
          key = stripeConfig.stripeSecret;
          console.log("✅ Stripe initialized from local stripe-config.json");
        } catch (e) {
          console.error("Error loading local stripe-config.json:", e);
        }
      }
    }

    if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is required');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

let firebaseAdminInitialized = false;
let lastFirebaseError: string | null = null;

function initFirebaseAdmin() {
  if (!firebaseAdminInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      // Remove quotes if present
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      // Handle escaped newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!projectId || !clientEmail || !privateKey) {
      // Try to load from local service-account.json if it exists
      const saPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(saPath)) {
        try {
          const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
          initializeApp({
            credential: cert(sa),
          });
          firebaseAdminInitialized = true;
          console.log("✅ Firebase Admin successfully initialized from local service-account.json");
          return;
        } catch (e: any) {
          lastFirebaseError = `Local SA Error: ${e.message}`;
          console.error("Error loading local service-account.json:", e);
        }
      }

      const missing = [];
      if (!projectId) missing.push("PROJECT_ID");
      if (!clientEmail) missing.push("CLIENT_EMAIL");
      if (!privateKey) missing.push("PRIVATE_KEY");
      
      lastFirebaseError = `Missing credentials: ${missing.join(", ")}`;
      console.warn("Firebase Admin credentials missing from environment and local file:", lastFirebaseError);
      return;
    }

    try {
      console.log("Initializing Firebase Admin with Project ID:", projectId);
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      firebaseAdminInitialized = true;
      lastFirebaseError = null;
      console.log("✅ Firebase Admin successfully initialized from environment");
    } catch (err: any) {
      lastFirebaseError = err.message;
      console.error("❌ Firebase Admin initialization error:", err);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Global middleware
  app.use((req, res, next) => {
    res.setHeader('X-App-Version', 'v2.5.1-STABLE-MARCH-17-13:12');
    res.setHeader('Permissions-Policy', 'serial=*');
    if (req.url.includes('/api/health')) {
      console.log(`[Health Check] Request for ${req.url} from ${req.ip}`);
    }
    next();
  });

  // Health check at the VERY top
  app.get(["/api/health", "/api/healt", "/health"], (req, res) => {
    // Attempt initialization so we can verify it works
    initFirebaseAdmin();
    
    res.json({ 
      status: "ok",
      version: "v2.5.1-STABLE-MARCH-17-13:12",
      firebaseAdminInitialized,
      lastFirebaseError,
      env: {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        nodeEnv: process.env.NODE_ENV
      },
      config: {
        stripeSecret: !!(process.env.STRIPE_SECRET_KEY || fs.existsSync(path.join(process.cwd(), 'stripe-config.json'))),
        stripePublishable: !!(process.env.VITE_STRIPE_PUBLISHABLE_KEY || fs.existsSync(path.join(process.cwd(), 'stripe-config.json'))),
        stripeWebhook: !!(process.env.STRIPE_WEBHOOK_SECRET || fs.existsSync(path.join(process.cwd(), 'stripe-config.json'))),
        firebaseAdmin: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) || fs.existsSync(path.join(process.cwd(), 'service-account.json'))
      }
    });
  });

  app.get("/api/stripe-status", (req, res) => {
    const key = process.env.STRIPE_SECRET_KEY || '';
    res.json({
      configured: !!key,
      mode: key.startsWith('sk_test_') ? 'test' : 'live',
      prefix: key.substring(0, 7) + '...'
    });
  });

  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Stripe webhook needs raw body
  // Stripe webhook handler
  const stripeWebhookHandler = async (req: any, res: any) => {
    initFirebaseAdmin();
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    console.log(`[Webhook Debug] Signature: ${sig}`);
    console.log(`[Webhook Debug] Body type: ${typeof req.body}`);
    console.log(`[Webhook Debug] Is Buffer: ${Buffer.isBuffer(req.body)}`);
    
    let endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      const stripePath = path.join(process.cwd(), 'stripe-config.json');
      if (fs.existsSync(stripePath)) {
        try {
          const stripeConfig = JSON.parse(fs.readFileSync(stripePath, 'utf8'));
          endpointSecret = stripeConfig.stripeWebhook;
        } catch (e) {}
      }
    }

    if (!sig || !endpointSecret) {
      return res.status(400).send('Missing Stripe signature or webhook secret');
    }

    let event: Stripe.Event;
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const db = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        console.log(`[Webhook] 💰 checkout.session.completed received for userId: ${userId}, session: ${session.id}`);
        if (userId) {
          const updateData: any = { 
            subscriptionStatus: 'active',
            lastUpdated: new Date().toISOString()
          };
          
          try {
            const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['line_items.data.price.product'],
            });
            const lineItem = expandedSession.line_items?.data[0];
            if (lineItem?.price?.product) {
              const product = lineItem.price.product as Stripe.Product;
              updateData.subscription = product.name;
              console.log(`[Webhook] Plan identified: ${product.name}`);
            }
          } catch (e) {
            console.error("Error fetching product name in webhook:", e);
          }

          if (session.customer) updateData.stripeCustomerId = session.customer;
          if (session.subscription) updateData.stripeSubscriptionId = session.subscription;
          
          const planName = (session.metadata?.tierName || updateData.subscription || '').toLowerCase();
          if (planName) {
            if (planName.includes('48 hour')) {
              updateData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('7 day')) {
              updateData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('1 month')) {
              updateData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
          }

          console.log(`[Webhook] 📝 Updating Firestore for user ${userId} with:`, updateData);
          await db.collection('users').doc(userId).set(updateData, { merge: true });
          console.log(`[Webhook] ✅ Firestore update successful for ${userId}`);
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] ❌ customer.subscription.deleted: ${subscription.id}`);
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('stripeSubscriptionId', '==', subscription.id).get();
        if (!snapshot.empty) {
          snapshot.forEach(async (doc) => {
            console.log(`[Webhook] 📝 Updating user ${doc.id} status to canceled`);
            await doc.ref.update({ subscriptionStatus: 'canceled' });
          });
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error(`[Webhook] ❌ Error processing webhook event:`, err);
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
  app.post('/api/stripe-webhook/', express.raw({ type: 'application/json' }), stripeWebhookHandler);



  app.get("/api/config", (req, res) => {
    let stripePublishable = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripePublishable) {
      const stripePath = path.join(process.cwd(), 'stripe-config.json');
      if (fs.existsSync(stripePath)) {
        try {
          const stripeConfig = JSON.parse(fs.readFileSync(stripePath, 'utf8'));
          stripePublishable = stripeConfig.stripePublishable;
        } catch (e) {}
      }
    }

    res.json({
      stripePublishable: stripePublishable || null,
      firebase: {
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
        databaseId: process.env.VITE_FIREBASE_DATABASE_ID
      }
    });
  });

  // Regular JSON parsing for other routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes FIRST
  app.get("/api", (req, res) => {
    res.json({ message: "RF Suite API is running", version: "v2.5.1-STABLE-MARCH-17-13:12" });
  });

  app.post("/api/send-email", async (req, res) => {
    let host = "unknown";
    try {
      console.log("📧 Received email request:", req.body);
      const { subject, message, userEmail } = req.body;
      
      let emailUser = process.env.EMAIL_USER;
      let emailPass = process.env.EMAIL_PASS;
      console.log(`📧 Checking credentials: EMAIL_USER='${emailUser}', EMAIL_PASS='${emailPass ? '***' : 'MISSING'}'`);
      let emailConfig: any = {};

      // Fallback to local file if env vars are missing
      if (!emailUser || !emailPass) {
        const emailPath = path.join(process.cwd(), 'email-config.json');
        if (fs.existsSync(emailPath)) {
          try {
            emailConfig = JSON.parse(fs.readFileSync(emailPath, 'utf8'));
            emailUser = emailConfig.emailUser;
            emailPass = emailConfig.emailPass;
            console.log("✅ Email credentials loaded from local email-config.json");
          } catch (e) {
            console.error("Error loading local email-config.json:", e);
          }
        }
      }

      if (!emailUser || !emailPass) {
        console.error("❌ Email credentials missing");
        return res.status(400).json({ error: "Email service is not configured. Please set EMAIL_USER and EMAIL_PASS in settings." });
      }

      // Auto-detect SMTP settings based on domain if not explicitly provided
      host = process.env.SMTP_HOST || emailConfig.host;
      let port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : emailConfig.port;
      let secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : emailConfig.secure;

      if (!host) {
        if (emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com') || emailUser.includes('@rfsuite.net')) {
          host = 'smtp.office365.com';
          port = 587;
          secure = false; // Office365 uses STARTTLS on 587
        } else {
          host = 'smtp.gmail.com';
          port = 465;
          secure = true;
        }
      }

      console.log(`📧 Using SMTP host: ${host}, port: ${port}, secure: ${secure}, user: ${emailUser.substring(0, 3)}...`);

      const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          // This helps with some Office365/Outlook certificate issues
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        },
        // Add timeout to prevent hanging
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const supportEmail = process.env.SUPPORT_EMAIL || 'info@rfsuite.net';
      console.log(`📧 Sending support email to: ${supportEmail ? supportEmail.substring(0, 3) + '...' : 'MISSING'}`);

      await transporter.sendMail({
        from: emailUser,
        to: supportEmail,
        replyTo: userEmail,
        subject: `New Contact Support Message: ${subject}`,
        text: `From: ${userEmail}\n\nMessage:\n${message}`,
      });

      console.log("✅ Email sent successfully");
      res.json({ success: true });
    } catch (err: any) {
      console.error("❌ Email error:", err);
      
      let errorMessage = `Failed to send email via ${host}`;
      if (err.message && err.message.includes("535")) {
        if (host.includes('gmail')) {
          errorMessage = "Gmail authentication failed. Please ensure you are using a 16-character 'App Password' instead of your regular password. You can generate one in your Google Account settings.";
        } else if (host.includes('office365') || host.includes('outlook')) {
          errorMessage = "Outlook/Office365 authentication failed. Please check your email and password. If you have 2-Step Verification enabled, you may need an 'App Password' from your Microsoft account settings.";
        } else {
          errorMessage = `Authentication failed for ${host}. Please verify your EMAIL_USER and EMAIL_PASS.`;
        }
      } else if (err.message && (err.message.includes("ETIMEDOUT") || err.message.includes("ECONNREFUSED"))) {
        errorMessage = `Connection to email server (${host}) failed. This might be a network issue or incorrect SMTP settings.`;
      } else if (err.message) {
        errorMessage = `Email Error (${host}): ${err.message}`;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/link-preview", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: "URL is required" });
      
      const preview = await getLinkPreview(url, {
        timeout: 3000,
        followRedirects: 'follow'
      });
      res.json(preview);
    } catch (err) {
      console.error("Link preview error:", err);
      res.status(500).json({ error: "Failed to fetch link preview" });
    }
  });

  app.get("/api/checkout-success", async (req, res) => {
    const sessionId = req.query.session_id as string;
    console.log(`[Success Route] Received session_id: ${sessionId}`);
    
    if (sessionId) {
      try {
        initFirebaseAdmin();
        const stripe = getStripe();
        console.log(`[Success Route] Retrieving Stripe session...`);
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['line_items.data.price.product'],
        });
        const userId = session.client_reference_id;
        console.log(`[Success Route] Session retrieved. UserID: ${userId}, FirebaseReady: ${firebaseAdminInitialized}`);
        
        if (userId && firebaseAdminInitialized) {
          const db = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
          const updateData: any = { 
            subscriptionStatus: 'active',
            lastUpdated: new Date().toISOString()
          };

          const lineItem = session.line_items?.data[0];
          if (lineItem?.price?.product) {
            const product = lineItem.price.product as Stripe.Product;
            updateData.subscription = product.name;
          }

          if (session.customer) updateData.stripeCustomerId = session.customer;
          if (session.subscription) updateData.stripeSubscriptionId = session.subscription;
          
          const planName = (session.metadata?.tierName || updateData.subscription || '').toLowerCase();
          if (planName) {
            if (planName.includes('48 hour')) {
              updateData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('7 day')) {
              updateData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('1 month')) {
              updateData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
          }

          console.log(`[Success Route] Updating Firestore for user ${userId}...`, updateData);
          await db.collection('users').doc(userId).set(updateData, { merge: true });
          console.log(`[Success Route] ✅ Firestore update successful`);
        } else {
          console.warn(`[Success Route] ⚠️ Skipping Firestore update: userId=${userId}, firebaseAdminInitialized=${firebaseAdminInitialized}`);
        }
      } catch (err) {
        console.error("[Success Route] ❌ Error verifying session on success route:", err);
      }
    }

    res.redirect('/?checkout=success');
  });

  app.get("/api/checkout-cancel", (req, res) => {
    res.redirect('/?checkout=cancel');
  });

  app.post("/api/test-checkout-success", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      
      const db = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      const updateData: any = {
        subscription: "48 Hour Pass Test",
        subscriptionStatus: "active",
        lastUpdated: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isTest: true
      };
      
      console.log(`[Test Success] Simulating success for user ${userId}...`);
      await db.collection('users').doc(userId).set(updateData, { merge: true });
      console.log(`[Test Success] ✅ Mock update successful`);
      
      res.json({ success: true, message: "Mock update successful" });
    } catch (err: any) {
      console.error("[Test Success] ❌ Mock update failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/portal-return", (req, res) => {
    res.redirect('/?portal=return');
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      console.log("[Checkout] Creating session request received");
      const stripe = getStripe();
      const { priceId, userId, email, returnUrl, tierName } = req.body;
      
      console.log("[Checkout] Params:", { priceId, userId, email, returnUrl, tierName });

      if (!priceId || !userId || !email || !returnUrl) {
        console.error("[Checkout] ❌ Missing required parameters");
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Fetch the price to determine if it's recurring or one-time
      const stripeKey = process.env.STRIPE_SECRET_KEY || '';
      const isTestKey = stripeKey.startsWith('sk_test_');
      console.log(`[Checkout] 🔍 Retrieving price details for: ${priceId}`);
      console.log(`[Checkout] 🔑 Using Stripe ${isTestKey ? 'TEST' : 'LIVE'} Key (starts with: ${stripeKey.substring(0, 7)}...)`);
      
      let price;
      try {
        price = await stripe.prices.retrieve(priceId);
      } catch (priceErr: any) {
        if (priceErr.code === 'resource_missing') {
          const msg = `[Checkout] ❌ Price ID ${priceId} NOT FOUND. You are using a ${isTestKey ? 'TEST' : 'LIVE'} key. Please ensure this Price ID exists in your Stripe ${isTestKey ? 'Test' : 'Live'} dashboard.`;
          console.error(msg);
          return res.status(404).json({ 
            error: "Price not found", 
            message: msg,
            mode: isTestKey ? 'test' : 'live'
          });
        }
        throw priceErr;
      }

      const mode = price.type === 'recurring' ? 'subscription' : 'payment';
      console.log(`[Checkout] ✅ Price found! Mode: ${mode}, Currency: ${price.currency}`);
      
      const session = await stripe.checkout.sessions.create({
        mode: mode,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${returnUrl}/api/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}/api/checkout-cancel`,
        client_reference_id: userId,
        customer_email: email,
        metadata: {
          tierName: tierName || 'Unknown Pass'
        }
      });

      console.log("[Checkout] ✅ Session created successfully:", session.id);
      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Checkout] ❌ Stripe session creation failed:", err.message);
      res.status(500).json({ 
        error: err.message,
        details: process.env.NODE_ENV !== 'production' ? err : undefined
      });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    try {
      const stripe = getStripe();
      const { customerId, returnUrl } = req.body;
      
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${returnUrl}/api/portal-return`,
      });

      res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("Stripe portal error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/backup-json", (req, res) => {
    const backup: Record<string, string> = {};
    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(process.cwd(), fullPath);
        if (
          relativePath.startsWith("node_modules") || 
          relativePath.startsWith("dist") || 
          relativePath.startsWith(".git") || 
          relativePath.startsWith("dev-dist") || 
          relativePath.endsWith(".zip") ||
          relativePath.endsWith(".png") ||
          relativePath.endsWith(".jpg") ||
          relativePath.endsWith(".ico")
        ) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else backup[relativePath] = fs.readFileSync(fullPath, 'utf8');
      }
    };
    try {
      walk(process.cwd());
      res.json(backup);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/backup-code-v2", (req, res) => {
    try {
      console.log("Starting backup-code generation...");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=RF_Suite_Source_${timestamp}.zip`);
      
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      archive.on('error', function(err) {
        console.error("Archiver error:", err);
        if (!res.headersSent) {
            res.status(500).send({ error: err.message });
        }
      });

      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.warn("Archiver warning:", err);
        } else {
          console.error("Archiver error:", err);
        }
      });

      archive.pipe(res);

      const rootDir = process.cwd();
      console.log("Root Dir:", rootDir);

      const walk = (dir: string, baseDir: string = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relativePath = path.join(baseDir, file);
          
          // Ignore patterns
          if (
            file === 'node_modules' || 
            file === 'dist' || 
            file === '.git' || 
            file === 'dev-dist' || 
            file.endsWith('.zip') ||
            file.endsWith('.sqlite') ||
            file.endsWith('.db')
          ) {
            continue;
          }

          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath, relativePath);
            } else {
              // console.log("Adding file:", relativePath); // Uncomment for debugging if needed
              archive.file(fullPath, { name: relativePath });
            }
          } catch (e) {
            console.warn(`Skipping file ${fullPath}:`, e);
          }
        }
      };

      walk(rootDir);

      archive.finalize();
    } catch (err) {
      console.error("Zip error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error creating zip: " + String(err));
      }
    }
  });

  app.get("/api/debug-dist", (req, res) => {
    try {
      const distPath = path.join(process.cwd(), "dist");
      if (!fs.existsSync(distPath)) {
        return res.json({ error: "dist not found", path: distPath });
      }
      
      const files: any[] = [];
      
      function walk(dir: string, relativePath: string = "") {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          const rel = path.join(relativePath, file);
          if (stat.isDirectory()) {
            walk(filePath, rel);
          } else {
            files.push({ path: rel, size: stat.size });
          }
        });
      }
      
      walk(distPath);
      res.json({ 
        cwd: process.cwd(),
        distPath,
        files,
        totalFiles: files.length,
        totalSize: files.reduce((acc, f) => acc + f.size, 0)
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/download-dist", (req, res) => {
    try {
      const distPath = path.join(process.cwd(), "dist");
      console.log("Download-dist requested. Dist path:", distPath);

      if (!fs.existsSync(distPath)) {
        console.error("Dist folder not found at:", distPath);
        return res.status(404).send("Build output (dist) not found. Please wait a moment and try again.");
      }
      
      const zip = new AdmZip();
      
      if (!fs.existsSync(distPath)) {
        console.error("Dist folder not found at:", distPath);
        return res.status(404).send("Build output (dist) not found. Please wait a moment and try again.");
      }

      // Use addLocalFolder for better reliability as suggested in generate-zip.ts
      zip.addLocalFolder(distPath);
      
      const buffer = zip.toBuffer();
      console.log("Zip created. Buffer size:", buffer.length);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `RF_Suite_DEPLOY_ME_${timestamp}.zip`;
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.end(buffer);
    } catch (err) {
      console.error("Dist zip error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error creating dist zip: " + String(err));
      }
    }
  });

  app.get("/api/download-deploy-zip", (req, res) => {
    try {
      const distPath = path.join(process.cwd(), "dist");
      console.log("Generating deploy zip from:", distPath);

      if (!fs.existsSync(distPath)) {
        console.error("Dist folder not found at:", distPath);
        return res.status(404).json({ error: "Build output (dist) not found. Please wait a moment and try again." });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=RF_Suite_Deploy_${timestamp}.zip`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      archive.on('error', function(err) {
        console.error("Archiver error:", err);
        if (!res.headersSent) {
            res.status(500).send({ error: err.message });
        }
      });

      // Pipe archive data to the response
      archive.pipe(res);

      // Add all files from dist, ignoring any zip files to prevent recursion
      archive.glob('**/*', { 
        cwd: distPath,
        ignore: ['*.zip', '**/*.zip'] 
      });

      archive.finalize();

    } catch (err) {
      console.error("Zip generation error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error creating zip: " + String(err) });
      }
    }
  });

  app.get("/api/lookup/uk-tv", (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const transmittersPath = path.join(process.cwd(), 'data', 'uk_transmitters.json');
      if (!fs.existsSync(transmittersPath)) {
        return res.json({ occupied: [] });
      }

      const transmitters = JSON.parse(fs.readFileSync(transmittersPath, 'utf8'));
      const channelData: Record<number, { maxErp: number, transmitterName: string, distance: number }> = {};
      const coveringNames: string[] = [];

      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Find all transmitters that cover this location
      // Ignore local fillers with ERP < 6W (0.006 kW)
      const covering = transmitters
        .filter((t: any) => t.erp && t.erp >= 0.006)
        .map((t: any) => {
          const distance = haversine(lat, lng, t.lat, t.lng);
          return { ...t, distance };
        })
        .filter((t: any) => t.distance <= Math.min(t.radius || 65, 65));

      if (covering.length > 0) {
        covering.forEach((t: any) => {
          let blocksChannel = false;
          t.channels.forEach((ch: number) => {
            // ERP Overrides based on provided CSV data
            let erp = t.erp;
            const overrides: Record<string, Record<number, number>> = {
              "Angus": { 33: 10, 36: 10, 48: 10 },
              "Arfon North": { 29: 8, 31: 8, 37: 8 },
              "Arfon South": { 41: 2, 44: 2, 47: 2 },
              "Beacon Hill": { 42: 10, 45: 10, 40: 10 },
              "Belmont": { 30: 64, 23: 75, 26: 75 },
              "Bilsdale": { 21: 117.5, 43: 50, 46: 50, 40: 50 },
              "Blaenplwyf": { 25: 10, 22: 10, 28: 10 },
              "Brougher Mountain": { 21: 2, 24: 2, 27: 2, 30: 1 },
              "Caldbeck": { 23: 50, 26: 50, 30: 50 },
              "Caradon Hill": { 21: 50, 24: 50, 27: 50 },
              "Carmel": { 33: 10, 36: 10, 48: 10 },
              "Chatton": { 29: 10, 31: 10, 37: 10 },
              "Craigkelly": { 29: 10, 31: 10, 37: 10 },
              "Darvel": { 32: 10, 34: 10, 35: 10 },
              "Divis": { 23: 50, 26: 50, 30: 50 },
              "Dover": { 39: 40, 42: 40, 48: 40 },
              "Durris": { 23: 50, 26: 50, 30: 50 },
              "Eitshal": { 25: 10, 22: 10 },
              "Hannington": { 40: 25, 43: 25, 46: 25 },
              "Huntshaw Cross": { 32: 10, 34: 10, 35: 10 },
              "Keelylang Hill": { 42: 10, 45: 10, 39: 10 },
              "Knockmore": { 33: 10, 36: 10, 48: 10 },
              "Limavady": { 40: 10, 43: 10, 46: 10 },
              "Midhurst": { 29: 10, 34: 10, 33: 10 },
              "Moel Y Parc": { 33: 10, 36: 10, 48: 10 },
              "Oxford": { 29: 50, 37: 50, 31: 50 },
              "Presely": { 42: 10, 45: 10, 39: 10 },
              "Redruth": { 48: 10, 33: 10, 32: 10 },
              "Ridge Hill": { 21: 10, 24: 10, 27: 10 },
              "Rosemarkie": { 43: 10, 46: 10, 40: 10 },
              "Rowridge": { 25: 50, 22: 50, 28: 50 },
              "Rumster Forest": { 32: 10, 34: 10, 35: 10 },
              "Sandy Heath": { 33: 170, 36: 170, 48: 170 },
              "Selkirk": { 33: 5, 36: 5, 48: 5 },
              "Stockland Hill": { 25: 25, 22: 25, 28: 25 },
              "Waltham": { 29: 25, 37: 25, 31: 25 },
              "Wenvoe": { 42: 50, 45: 50, 39: 50 }
            };

            if (overrides[t.name] && overrides[t.name][ch] !== undefined) {
              erp = overrides[t.name][ch];
            }
            
            // Apply SIR formula
            const range = UK_TV_CHANNELS[ch];
            const f_MHz = range ? (range[0] + range[1]) / 2 : 600;
            const ERP_W = erp * 1000;
            const d_TV_km = Math.max(t.distance, 0.001); // Prevent log10(0)
            
            // Earth curvature / terrain penalty: 1.5 dB extra path loss per km over 40km
            const terrainPenalty = d_TV_km > 40 ? (d_TV_km - 40) * 1.5 : 0;
            
            const sir = 10 
                      - 20 * Math.log10(f_MHz) 
                      - 20 * Math.log10(0.02) 
                      - 10 * Math.log10(ERP_W) 
                      + 20 * Math.log10(d_TV_km) 
                      - 44.14
                      + terrainPenalty;
                      
            if (sir < 20) {
              blocksChannel = true;
              if (!channelData[ch] || erp > channelData[ch].maxErp) {
                channelData[ch] = { maxErp: erp, transmitterName: t.name, distance: parseFloat(t.distance.toFixed(1)) };
              }
            }
          });
          
          if (blocksChannel) {
            coveringNames.push(t.name);
          }
        });
      }

      res.json({ 
        occupied: channelData,
        transmitters: coveringNames
      });
    } catch (err) {
      console.error("UK TV Lookup error:", err);
      res.status(500).json({ error: "Failed to lookup TV transmitters" });
    }
  });

  app.get("/api/lookup/us-tv", (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const latGrid = Math.floor(lat / 2);
      const lngGrid = Math.floor(lng / 2);
      
      let transmitters: any[] = [];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const transmittersPath = path.join(process.cwd(), 'data', 'us_partitioned', `${latGrid + i}_${lngGrid + j}.json`);
            if (fs.existsSync(transmittersPath)) {
                transmitters = transmitters.concat(JSON.parse(fs.readFileSync(transmittersPath, 'utf8')));
            }
        }
      }
      
      if (transmitters.length === 0) {
        return res.json({ occupied: [] });
      }
      const channelData: Record<number, { maxErp: number, transmitterName: string, distance: number }> = {};
      const coveringNames: string[] = [];

      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Find all transmitters that cover this location
      // Ignore local fillers with ERP <= 5W (0.005 kW)
      const covering = transmitters
        .filter((t: any) => !t.erp || t.erp > 0.005)
        .map((t: any) => {
          const distance = haversine(lat, lng, t.lat, t.lng);
          return { ...t, distance };
        })
        .filter((t: any) => t.distance <= Math.min(t.radius || 65, 65));

      if (covering.length > 0) {
        covering.forEach((t: any) => {
          let blocksChannel = false;
          t.channels.forEach((ch: number) => {
            const erp = t.erp || 100;
            
            // Apply SIR formula
            const range = US_TV_CHANNELS[ch];
            const f_MHz = range ? (range[0] + range[1]) / 2 : 600;
            const ERP_W = erp * 1000;
            const d_TV_km = Math.max(t.distance, 0.001); // Prevent log10(0)
            
            // Earth curvature / terrain penalty: 1.5 dB extra path loss per km over 40km
            const terrainPenalty = d_TV_km > 40 ? (d_TV_km - 40) * 1.5 : 0;
            
            const sir = 10 
                      - 20 * Math.log10(f_MHz) 
                      - 20 * Math.log10(0.02) 
                      - 10 * Math.log10(ERP_W) 
                      + 20 * Math.log10(d_TV_km) 
                      - 44.14
                      + terrainPenalty;
                      
            if (sir < 20) {
              blocksChannel = true;
              if (!channelData[ch] || erp > (channelData[ch]?.maxErp || 0)) {
                channelData[ch] = { maxErp: erp, transmitterName: t.name, distance: parseFloat(t.distance.toFixed(1)) };
              }
            }
          });
          
          if (blocksChannel) {
            coveringNames.push(t.name);
          }
        });
      }

      res.json({ 
        occupied: channelData,
        transmitters: coveringNames
      });
    } catch (err) {
      console.error("US TV Lookup error:", err);
      res.status(500).json({ error: "Failed to lookup TV transmitters" });
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
    // Serve static files in production
    const staticPath = path.join(process.cwd(), 'dist');
    app.use(express.static(staticPath, {
      setHeaders: (res, path) => {
        // Ensure index.html is never cached so users always get the latest version
        if (path.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.use((req, res, next) => {
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(staticPath, "index.html"));
      } else {
        next();
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
