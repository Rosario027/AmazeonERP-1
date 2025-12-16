import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, File, Image, FileText, Trash2, Download } from "lucide-react";

interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

interface FileUploadProps {
  onFileUploaded?: (file: UploadedFile) => void;
  onFilesUploaded?: (files: UploadedFile[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // in MB
}

export function FileUpload({
  onFileUploaded,
  onFilesUploaded,
  multiple = false,
  accept = "image/*,application/pdf",
  maxSize = 10, // 10MB default
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith("image/")) {
      return <Image className="h-8 w-8 text-blue-500" />;
    } else if (mimetype === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const validateFile = (file: File): boolean => {
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxSize}MB`,
        variant: "destructive",
      });
      return false;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only images and PDFs are allowed",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    if (!validateFile(file)) return null;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      return data.file;
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    const fileArray = Array.from(files);
    const uploaded: UploadedFile[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const result = await uploadFile(fileArray[i]);
      if (result) {
        uploaded.push(result);
        if (onFileUploaded) {
          onFileUploaded(result);
        }
      }
      setUploadProgress(((i + 1) / fileArray.length) * 100);
    }

    if (uploaded.length > 0) {
      setUploadedFiles((prev) => [...prev, ...uploaded]);
      if (onFilesUploaded) {
        onFilesUploaded(uploaded);
      }
      toast({
        title: "Upload successful",
        description: `${uploaded.length} file(s) uploaded successfully`,
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        if (multiple) {
          uploadFiles(files);
        } else {
          uploadFiles([files[0]]);
        }
      }
    },
    [multiple]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/files/${filename}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        setUploadedFiles((prev) => prev.filter((f) => f.filename !== filename));
        toast({
          title: "File deleted",
          description: "File deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleDownload = (file: UploadedFile) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium mb-2">
          Drag and drop your files here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse (Images & PDFs, max {maxSize}MB)
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          Select Files
        </Button>

        {isUploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-gray-500 mt-2">
              Uploading... {Math.round(uploadProgress)}%
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.mimetype)}
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">
                        {file.originalName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {file.mimetype.startsWith("image/") && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <Image className="h-5 w-5" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteFile(file.filename)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Simple file preview component
interface FilePreviewProps {
  url: string;
  mimetype: string;
  className?: string;
}

export function FilePreview({ url, mimetype, className = "" }: FilePreviewProps) {
  if (mimetype.startsWith("image/")) {
    return (
      <img
        src={url}
        alt="Preview"
        className={`max-w-full h-auto rounded ${className}`}
      />
    );
  }

  if (mimetype === "application/pdf") {
    return (
      <iframe
        src={url}
        className={`w-full h-96 rounded ${className}`}
        title="PDF Preview"
      />
    );
  }

  return (
    <div className="flex items-center justify-center p-4 bg-gray-100 rounded">
      <File className="h-12 w-12 text-gray-400" />
      <span className="ml-2">Preview not available</span>
    </div>
  );
}
