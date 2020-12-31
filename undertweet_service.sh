DATE=`date '+%Y-%m-%d %H:%M:%S'`
echo "Example service started at ${DATE}" | systemd-cat -p info

node /home/eduardo_chapa_gmail_com/undertweet/server.js
