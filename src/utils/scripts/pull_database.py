import subprocess

# Set the path to the database on the device
device_db_path = "/data/data/com.lifelog/files/default.realm"

# Set the path to the destination on your PC
pc_db_path = "C:\\Users\\philk\\Projects\\LifeLog\\src\\utils\\db"

# Try to pull the database file from the device to your PC
try:
    subprocess.run(["adb", "pull", device_db_path, pc_db_path])
except subprocess.CalledProcessError:
    print("Error: Unable to pull database file")