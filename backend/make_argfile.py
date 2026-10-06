import os
import glob

# Read the template argfile from Temp
temp_files = glob.glob(os.path.expandvars(r"%TEMP%\spring-boot-*.argfile"))
if not temp_files:
    raise RuntimeError("No spring-boot argfile found in %TEMP%")

with open(temp_files[0], 'r', encoding='utf-8') as f:
    content = f.read().strip()

# Replace class dir
backend_classes = r"D:\project\MDotenterprises\backend\target\classes"
parts = content.split(";")
clean_parts = [backend_classes]

# Filter out old printease target/classes and keep all maven jars
for p in parts:
    clean_p = p.strip('" ')
    if "printease-backend" in clean_p or "target\\classes" in clean_p:
        continue
    if os.path.exists(clean_p):
        clean_parts.append(clean_p)

# Extra PDFBox dependencies
extra_jars = [
    r"C:\Users\Lenovo\.m2\repository\org\apache\pdfbox\pdfbox\3.0.1\pdfbox-3.0.1.jar",
    r"C:\Users\Lenovo\.m2\repository\org\apache\pdfbox\pdfbox-io\3.0.1\pdfbox-io-3.0.1.jar",
    r"C:\Users\Lenovo\.m2\repository\org\apache\pdfbox\fontbox\3.0.1\fontbox-3.0.1.jar",
    r"C:\Users\Lenovo\.m2\repository\commons-logging\commons-logging\1.3.5\commons-logging-1.3.5.jar",
]

for jar in extra_jars:
    if os.path.exists(jar) and jar not in clean_parts:
        clean_parts.append(jar)

argfile_content = f'"{";".join(clean_parts)}"'
output_file = r"D:\project\MDotenterprises\backend\studio.argfile"

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(argfile_content)

print(f"Wrote {len(clean_parts)} entries to {output_file}")
