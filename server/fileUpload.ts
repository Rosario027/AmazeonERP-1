import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, Router } from "express";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
// Use absolute path relative to this file to ensure consistency regardless of CWD
const uploadsDir = path.resolve(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create staff ID proofs directory
const staffUploadsDir = path.join(uploadsDir, "staff-id-proofs");
if (!fs.existsSync(staffUploadsDir)) {
  fs.mkdirSync(staffUploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Staff ID proof storage (max 5 files, 5MB total)
const staffStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, staffUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `staff-${uniqueSuffix}${ext}`);
  },
});

// File filter to accept only images and PDFs
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images and PDFs are allowed."));
  }
};

// Staff file filter (pdf, jpg, png, docx)
const staffFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, JPG, PNG, and DOCX are allowed."));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Staff upload multer (max 5 files, 5MB total)
export const staffUpload = multer({
  storage: staffStorage,
  fileFilter: staffFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file
    files: 5, // Max 5 files
  },
});

// File upload router
export const fileUploadRouter = Router();

// Upload single file
fileUploadRouter.post("/upload", (req: Request, res: Response) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: err.message || "File upload failed" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileInfo = {
        id: req.file.filename,
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/api/files/${req.file.filename}`,
      };

      res.json({
        message: "File uploaded successfully",
        file: fileInfo,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
});

// Upload multiple files (up to 10)
fileUploadRouter.post("/upload-multiple", (req: Request, res: Response) => {
  upload.array("files", 10)(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: err.message || "File upload failed" });
    }

    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const fileInfos = files.map((file) => ({
        id: file.filename,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/api/files/${file.filename}`,
      }));

      res.json({
        message: "Files uploaded successfully",
        files: fileInfos,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });
});

// Get/download file by filename
fileUploadRouter.get("/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    // Get file stats and mime type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    
    res.setHeader("Content-Type", contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error("File retrieval error:", error);
    res.status(500).json({ message: "Failed to retrieve file" });
  }
});

// Delete file
fileUploadRouter.delete("/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    fs.unlinkSync(filePath);
    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("File deletion error:", error);
    res.status(500).json({ message: "Failed to delete file" });
  }
});

// List all uploaded files
fileUploadRouter.get("/", (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    
    const fileInfos = files.map((filename) => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
      };

      return {
        id: filename,
        filename,
        mimetype: mimeTypes[ext] || "application/octet-stream",
        size: stats.size,
        createdAt: stats.birthtime,
        url: `/api/files/${filename}`,
      };
    });

    res.json({ files: fileInfos });
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({ message: "Failed to list files" });
  }
});

// ============================================
// Staff ID Proof Upload Router
// ============================================
export const staffUploadRouter = Router();

// Upload staff ID proof files (max 5 files, 5MB total)
staffUploadRouter.post("/upload", (req: Request, res: Response) => {
  staffUpload.array("files", 5)(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: err.message || "File upload failed" });
    }

    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Check total size (5MB max)
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 5 * 1024 * 1024) {
        // Delete the uploaded files
        files.forEach(f => {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {
            console.error("Failed to delete file:", e);
          }
        });
        return res.status(400).json({ message: "Total file size must not exceed 5MB" });
      }

      const fileInfos = files.map((file) => ({
        id: file.filename,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/api/staff/files/${file.filename}`,
      }));

      res.json({
        message: "Files uploaded successfully",
        files: fileInfos,
      });
    } catch (error) {
      console.error("Staff upload error:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });
});

// Get/download staff file by filename
staffUploadRouter.get("/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(staffUploadsDir, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(staffUploadsDir)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    
    res.setHeader("Content-Type", contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error("Staff file retrieval error:", error);
    res.status(500).json({ message: "Failed to retrieve file" });
  }
});

// Delete staff file
staffUploadRouter.delete("/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(staffUploadsDir, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(staffUploadsDir)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    fs.unlinkSync(filePath);
    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Staff file deletion error:", error);
    res.status(500).json({ message: "Failed to delete file" });
  }
});
