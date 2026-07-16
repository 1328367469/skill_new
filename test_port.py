import socket

def test_connection(host):
    s = socket.socket(socket.AF_INET if ':' not in host else socket.AF_INET6, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect((host, 8234))
        print(f"Successfully connected to {host}:8234!")
        s.close()
        return True
    except Exception as e:
        print(f"Failed to connect to {host}:8099:", e)
        return False

if __name__ == '__main__':
    test_connection('127.0.0.1')
    test_connection('localhost')
    test_connection('::1')
