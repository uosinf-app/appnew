# النسخة 20.x (موصى بها لأنك تستخدم 20.14.0)
echo '{ pkgs }: {' > replit.nix
echo '  deps = [' >> replit.nix
echo '    pkgs.nodejs-20_x' >> replit.nix
echo '    pkgs.nodePackages.npm' >> replit.nix
echo '  ];' >> replit.nix
echo '}' >> replit.nix
