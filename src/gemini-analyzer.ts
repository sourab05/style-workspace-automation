
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Converts a local file to a GoogleGenerativeAI.Part object.
function fileToGenerativePart(path: string, mimeType: string) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

export async function analyzeImageDifference(
  baseImage: string,
  actualImage: string,
  token: string
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the .env file");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

  const prompt = `
    Here are two images: a base screenshot and an actual screenshot.
    A design token has been applied to the actual screenshot.
    The design token is: ${token}
    Please analyze the difference between the two images and tell me if the token has been applied correctly.
  `;

  const imageParts = [
    fileToGenerativePart(baseImage, "image/png"),
    fileToGenerativePart(actualImage, "image/png"),
  ];

  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;
  const text = response.text();

  return text;
}

