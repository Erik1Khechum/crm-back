import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/user.js";
import multer from "multer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const port = 3001;
const dbUrl = process.env.DBURL;
const secretKey = process.env.SECRETKEY;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "storage/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const dbConnect = async () => {
  try {
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB Atlas");
  } catch (error) {
    console.log(error);
  }
};

dbConnect();

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1].replace(/"/g, "");
  if (!token) return res.status(401).json({ message: "Access denied" });
  try {
    const verified = jwt.verify(token, secretKey);
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token", error: error.message });
  }
};

app.get("/getUsers", verifyToken, (req, res) => {
  const email = req.headers["email"];
  User.find()
    .then((users) => users.filter((user) => user.email == email))
    .then((users) => res.json(users))
    .catch((error) => console.log("database error", error));
});

app.post("/registration", upload.single("img"), async (req, res) => {
  const { email, password, name, surname, birthday, gender } = req.body;
  const hashedPass = await bcrypt.hash(password, 5);
  const img = req.file.filename;
  const post = new User({
    email,
    hashedPass,
    name,
    surname,
    birthday,
    gender,
    img,
  });
  post
    .save()
    .then((result) => res.send(result))
    .catch((error) => console.log("database error", error));
});

app.get("/getUsers", verifyToken, (req, res) => {
  User.find()
    .then((users) => res.json(users))
    .catch((error) => console.log("database error", error));
});

app.use("/images", express.static("storage"));

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log(email);
  User.findOne({ email: email })
    .select("email hashedPass")
    .exec()
    .then((user) => {
      bcrypt
        .compare(password, user.hashedPass)
        .then((result) => {
          if (result) {
            const token = jwt.sign({ email: email }, secretKey);
            res.json({
              token: token,
              email: email,
            });
          } else {
            res.status(400).send("Invalid Password");
          }
        })
        .catch((error) => {
          console.error(error);
        });
    })
    .catch((err) => {
      console.error(err);
      res.status(400).send("User not found");
    });
});

app.put("/updateUsers", verifyToken, upload.single("img"), async (req, res) => {
  const img = req.file.filename;
  const { name, password, email } = req.body;
  const hashedPass = await bcrypt.hash(password, 5);
  User.findOneAndUpdate(
    { email: email },
    { $set: { name, img, hashedPass } },
    { new: true }
  )
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(200).json(updatedUser);
      } else {
        res.status(404).json({ error: "User not found" });
      }
    })
    .catch((error) => {
      console.log("database error", error);
      res
        .status(500)
        .json({ error: "An error occurred while updating the user" });
    });
});

app.post("/logOut", (req, res) => {
  return res.send({
    isAuthenticated: false,
  });
});

app.listen(port, () => {
  console.log("Server is Running");
});
