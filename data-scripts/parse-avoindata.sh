#!/bin/bash

mkdir -p data

# convert from retarded encoding to UTF-8
iconv -f CP850 -t UTF8 avoindata/vaalikoneet/kuntavaalit2017/vaalikonedata-28-3-2017-verkkoon.csv > data/data.csv

# convert to JSON
python parseCsv.py data/questions.json data/answers.json < data/data.csv
