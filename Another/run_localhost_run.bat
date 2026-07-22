@echo off

echo Dang tao duong ham truc tiep vao localhost:8080 (Khong bi chan boi trinh duyet)...

ssh -o StrictHostKeyChecking=no -R 80:localhost:8080 nokey@localhost.run

pause
