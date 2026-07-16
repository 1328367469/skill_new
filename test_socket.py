import socket
import threading
import time

def start_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 9001))
    s.listen(1)
    print("Server: Listening on 9001...")
    try:
        conn, addr = s.accept()
        print("Server: Accepted connection from", addr)
        conn.sendall(b"Hello from server!")
        conn.close()
    except Exception as e:
        print("Server: Error:", e)
    finally:
        s.close()

def main():
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()
    
    time.sleep(1)
    
    print("Client: Connecting to 9001...")
    c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    c.settimeout(3)
    try:
        c.connect(('127.0.0.1', 9001))
        data = c.recv(1024)
        print("Client: Received:", data.decode())
        c.close()
    except Exception as e:
        print("Client: Error:", e)

if __name__ == '__main__':
    main()
