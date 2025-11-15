const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const { sendEmail } = require("./email");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database
const db = new sqlite3.Database("./database/data.db", (err) => {
  if(err) console.error(err.message);
  else console.log("Connected to SQLite DB");
});

// Create tables if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    balance INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount INTEGER,
    status TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS otp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    code TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper: generate OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- ENDPOINTS ---
app.post("/send-otp", async (req,res)=>{
  const { email } = req.body;
  if(!email) return res.json({ error:"Email wajib diisi" });
  const code = generateOtp();
  db.run("INSERT INTO otp (email, code) VALUES (?,?)", [email, code]);
  try{
    await sendEmail(email,"Kode OTP",`Kode OTP Anda: <b>${code}</b>`);
    res.json({ success:true });
  } catch(err){
    res.json({ error:"Gagal kirim OTP" });
  }
});

app.post("/register", (req,res)=>{
  const { name,email,password,otp } = req.body;
  if(!name || !email || !password || !otp) return res.json({ error:"Semua field wajib diisi" });
  db.get("SELECT code FROM otp WHERE email=? ORDER BY id DESC LIMIT 1", [email], (err,row)=>{
    if(err) return res.json({ error:err.message });
    if(!row || row.code !== otp) return res.json({ error:"OTP salah atau kadaluarsa" });
    db.run("INSERT INTO users (name,email,password) VALUES (?,?,?)", [name,email,password], function(err){
      if(err) return res.json({ error:"Email sudah terdaftar" });
      res.json({ success:true, user:{ id:this.lastID, name, email, balance:0 } });
    });
  });
});

app.post("/login",(req,res)=>{
  const { email,password } = req.body;
  db.get("SELECT * FROM users WHERE email=? AND password=?", [email,password], (err,row)=>{
    if(err) return res.json({ error:err.message });
    if(!row) return res.json({ error:"Email/Password salah" });
    res.json({ success:true, user:row });
  });
});

app.post("/generate-qris", async (req,res)=>{
  const { userId, amount } = req.body;
  if(!userId || !amount) return res.json({ error:"Data tidak lengkap" });

  const qrUrl = `https://dummy-qris.com/pay?amount=${amount}&user=${userId}`;
  db.run("INSERT INTO transactions (user_id, amount, status) VALUES (?,?,?)", [userId, amount, "pending"]);
  res.json({ success:true, qrUrl });
});

app.post("/get-user",(req,res)=>{
  const { userId } = req.body;
  db.get("SELECT id,name,email,balance FROM users WHERE id=?", [userId], (err,row)=>{
    if(err) return res.json({ error:err.message });
    if(!row) return res.json({ error:"User tidak ditemukan" });
    res.json({ success:true, user:row });
  });
});

app.post("/get-transactions",(req,res)=>{
  const { userId } = req.body;
  db.all("SELECT amount,status,created_at FROM transactions WHERE user_id=? ORDER BY created_at DESC", [userId], (err,rows)=>{
    if(err) return res.json({ error:err.message });
    res.json({ success:true, transactions: rows });
  });
});

// Simulasi bayar QRIS (production: webhook Duitku)
app.post("/pay-qris", (req,res)=>{
  const { userId, amount } = req.body;
  db.run("UPDATE users SET balance = balance + ? WHERE id=?", [amount,userId]);
  db.run("UPDATE transactions SET status='paid' WHERE user_id=? AND amount=? AND status='pending'", [userId,amount]);
  res.json({ success:true });
});

app.listen(process.env.PORT || 3000, ()=>{
  console.log("Server running...");
});