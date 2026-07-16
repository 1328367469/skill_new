import urllib.request
import zipfile
import os

def download_and_extract():
    url = "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"
    zip_path = "python_embed.zip"
    extract_dir = "clean_python"
    
    print("Downloading clean Python embeddable zip...")
    try:
        # Download the file
        urllib.request.urlretrieve(url, zip_path)
        print("Download completed successfully!")
    except Exception as e:
        print("Failed to download Python:", e)
        return
        
    print("Extracting Python to clean_python directory...")
    try:
        if not os.path.exists(extract_dir):
            os.makedirs(extract_dir)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        print("Extraction completed successfully!")
        
        # Clean up zip file
        os.remove(zip_path)
        print("Cleaned up zip archive.")
    except Exception as e:
        print("Failed to extract Python:", e)

if __name__ == '__main__':
    download_and_extract()
