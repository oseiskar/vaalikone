# encoding: utf-8
import csv, json, sys, collections

questionFile = sys.argv[1]
answerFile = sys.argv[2]

output = []
questions = {}
questionsReversed = []

for row in csv.DictReader(sys.stdin, delimiter=';'):

    row.pop('Määrä')

    person = {
        'party': row.pop('Puolue'),
        'city': row.pop('Kunta'),
        'name': row.pop('Etunimi') + ' ' + row.pop('Sukunimi')
    }

    answers = collections.OrderedDict()

    for k, v in row.items():
        if k in questions:
            questionId = questions[k]
        else:
            questionId = len(questions) + 1
            questions[k] = questionId
            questionsReversed.append({
                'id': int(questionId),
                'question': k,
            })

        if len(v) > 0:
            if ',' in v:
                value = float(v.replace(',', '.'))
            else:
                value = int(v)
            answers[questionId] = value

    output.append({
        'person': person,
        'answers': answers
    })

with open(questionFile, 'w') as f:
    json.dump(questionsReversed, f, indent=4)


with open(answerFile, 'w') as f:
    json.dump(output, f, indent=4)
