const mongoose = require("mongoose");

// === 🧩 SCHEMA — Gestion des 5 roues par token ===
const rewardSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  wheels: [
    {
      wheelId: { type: Number, required: true },
      label: { type: String, default: "" },
      rewards: [
        {
          name: { type: String, required: true },
          image: String,
          webhook: String, // facultatif
          method: { type: String, enum: ["GET", "POST"], default: "GET" },
          chance: { type: Number, default: 100 },
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Reward", rewardSchema);
