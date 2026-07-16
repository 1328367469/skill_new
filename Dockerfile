# Use a lightweight official Python base image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the application source code
COPY . /app

# Expose port 8234 for the HTTP server
EXPOSE 8234

# Run the python server directly in unbuffered mode
CMD ["python", "-u", "server.py"]
