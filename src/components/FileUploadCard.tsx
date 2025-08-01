import React, { useState, useRef } from 'react';
import { Card } from 'react-bootstrap';
import { Upload } from 'lucide-react';
import '../css/FileUploadCard.css'

interface FileUploadCardProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string;
  title?: string;
  description?: string;
  multiple?: boolean;
  name?: string;
  children?: React.ReactNode;
}

function FileUploadCard({
  onFilesSelected,
  acceptedTypes = ".csv,.tsv,.txt",
  title = "File Upload",
  description = "Drag and drop files here or click to browse",
  multiple = true,
  name = 'fileUploadCard',
  children
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function isValidFileType(file: File) {
    const allowedTypes = acceptedTypes.split(',').map(type => type.trim().toLowerCase());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const fileMimeType = file.type.toLowerCase();
    return allowedTypes.includes(fileExtension) || allowedTypes.includes(fileMimeType);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(isValidFileType);
    if (files.length > 0) {
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInputRef.current.files = dataTransfer.files;
      }
      onFilesSelected(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  return (
    <Card className='mb-3'>
      <Card.Header>{title}</Card.Header>
      <Card.Body>
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} />
          <p>{description}</p>
          <small className="text-muted">{acceptedTypes}</small>
        </div>
        <label htmlFor={name} style={{ display: 'none' }}>{title}</label>
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          name={name}
          id={name}
        />
        {children}
      </Card.Body>
    </Card>
  );
};

export default FileUploadCard;