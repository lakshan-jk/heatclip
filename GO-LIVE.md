# Go live for $0 — Oracle Always Free + DuckDNS

Total cost: **$0/forever**. You get a real always-on server with HTTPS on
`https://heatclip.duckdns.org` (swap in a real domain later without rebuilding).

> Oracle's free VM sign-up asks for a credit card for **identity verification
> only** — an "Always Free" instance is never charged.

---

## 1. Get a free subdomain (DuckDNS) — 2 min
1. Go to https://www.duckdns.org and sign in (GitHub/Google).
2. Create a subdomain, e.g. **heatclip** → gives you `heatclip.duckdns.org`.
3. Leave it for now — you'll set its IP in step 3 once the server exists.

## 2. Create the free server (Oracle Cloud) — 10 min
1. Sign up at https://www.oracle.com/cloud/free/ (pick a home region near you).
2. **Create instance** → Compute → Instances → *Create*:
   - **Shape:** change to **Ampere (ARM)** → `VM.Standard.A1.Flex`.
     Set **2 OCPU / 12 GB** (well within Always Free: 4 OCPU / 24 GB).
   - **Image:** Canonical **Ubuntu 22.04**.
   - **SSH keys:** upload/generate — save the private key.
   - Create. Note the **public IP**.
3. Point DuckDNS at it: on duckdns.org, set your domain's **current ip** to the
   VM's public IP and *update*.

## 3. Open the ports (the #1 gotcha — do BOTH) — 5 min
Oracle blocks traffic in two places:

**a) VCN security list (cloud firewall):**
Networking → Virtual Cloud Networks → your VCN → Security Lists → default →
*Add Ingress Rules*: source `0.0.0.0/0`, TCP, destination ports **80** and **443**.

**b) The VM's own iptables** (Oracle Ubuntu blocks by default). SSH in and run:
```bash
ssh -i your-key ubuntu@YOUR_SERVER_IP
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 4. Get the code onto the server
Easiest is a (private) GitHub repo:
```bash
# on your Mac, from ~/Documents/heatclip:
git add -A && git commit -m "HeatClip"
gh repo create heatclip --private --source=. --push   # or push to a repo you made
```
Then on the server:
```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<you>/heatclip.git && cd heatclip
```
(No GitHub? `rsync -av --exclude node_modules --exclude .venv --exclude .next \
  ~/Documents/heatclip/ ubuntu@YOUR_SERVER_IP:~/heatclip/` also works.)

## 5. Deploy — 1 command
```bash
./provision.sh heatclip.duckdns.org
```
It installs Docker, generates your auth secret, builds both images, and starts
everything behind Caddy. First build pulls ffmpeg + builds Next, so give it a
few minutes on ARM.

## 6. Verify
Open **https://heatclip.duckdns.org** — Caddy auto-issues a Let's Encrypt cert on
first load. Paste a YouTube link and generate a Short. Done. 🎉

```bash
docker compose logs -f        # watch
git pull && ./provision.sh    # update after changes
```

---

## Upgrading to a real domain later (no rebuild)
Buy `heatclip.app` (~$10/yr), point its DNS A record at the same server IP, then:
```bash
./provision.sh heatclip.app     # re-run with the new domain; Caddy re-issues TLS
```

## Honest limits of the free tier
- Rendering is CPU-bound; the free ARM cores handle a few clips fine but won't
  scale to many concurrent users. That's your signal to move to a bigger VM.
- Keep an eye on the free block storage (~200 GB) — rendered clips accumulate in
  the `heatclip_data` volume; add a cleanup cron before heavy use.
- If Oracle ARM capacity is unavailable in your region, retry later or pick a
  different home region — free ARM is popular.
