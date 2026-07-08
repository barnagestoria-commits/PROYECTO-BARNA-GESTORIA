"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Upload, File, X, Camera } from "lucide-react"
import { InvoiceCameraCapture } from "@/components/invoice-camera-capture"

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number
  disabled?: boolean
  showCamera?: boolean
  cameraTourId?: string
}

export function FileUpload({
  onFilesSelected,
  accept = ".pdf,.jpg,.jpeg,.png",
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  showCamera = false,
  cameraTourId,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)

  const loweredAccept = accept.toLowerCase()
  const supportsCamera =
    showCamera &&
    (loweredAccept.includes("jpg") ||
      loweredAccept.includes("jpeg") ||
      loweredAccept.includes("png"))

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(",").reduce(
      (acc, ext) => {
        acc[ext.trim()] = []
        return acc
      },
      {} as Record<string, string[]>,
    ),
    multiple,
    maxSize,
    disabled,
  })

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles)
      setSelectedFiles([])
    }
  }

  const handleCameraCapture = (file: File) => {
    onFilesSelected([file])
  }

  return (
    <div className="space-y-4">
      {supportsCamera && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          data-tour={cameraTourId}
        >
          <Camera className="mr-2 h-4 w-4" />
          Escanear factura con cámara
        </Button>
      )}

      <InvoiceCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            : isDragActive
              ? "cursor-pointer border-blue-500 bg-blue-50"
              : "cursor-pointer border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600">Suelta los archivos aquí...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-1">Arrastra archivos aquí o haz clic para seleccionar</p>
            <p className="text-xs text-gray-400">
              Formatos: {accept} • Máximo {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </div>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Archivos seleccionados:</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-gray-400">({Math.round(file.size / 1024)} KB)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={handleUpload} className="w-full" disabled={disabled}>
            <Upload className="h-4 w-4 mr-2" />
            Subir {selectedFiles.length} archivo{selectedFiles.length > 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  )
}
