# usage: sheet.sh out.jpg f1 f2 ... (even count)
out=$1; shift; n=$#; args=""; fc=""; i=0
for f in "$@"; do args="$args -i $f"; fc="$fc[$i]scale=960:-1[v$i];"; i=$((i+1)); done
rows=""; r=0
for ((j=0;j<n;j+=2)); do fc="$fc[v$j][v$((j+1))]hstack[r$r];"; rows="$rows[r$r]"; r=$((r+1)); done
fc="$fc${rows}vstack=inputs=$r"
ffmpeg -v error -y $args -filter_complex "$fc" $out
