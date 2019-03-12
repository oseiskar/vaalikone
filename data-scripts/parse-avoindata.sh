#!/bin/bash

mkdir -p data

# create attribution and metadata
cat <<EOF > data/meta.json
{
  "title": "Kuntavaalit 2017",
  "copyright": {
    "text": "Helsingin Sanomat (CC BY 4.0)",
    "url": "https://github.com/HS-Datadesk/avoindata"
  }
}
EOF

# convert from retarded encoding to UTF-8
iconv -f CP850 -t UTF8 avoindata/vaalikoneet/kuntavaalit2017/vaalikonedata-28-3-2017-verkkoon.csv > data/data.csv

# convert to JSON
python data-scripts/parseCsv.py data/questions.json data/answers.json < data/data.csv
