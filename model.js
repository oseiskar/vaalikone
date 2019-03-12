'use strict';

class Model {
  constructor(answers) {
    this.answers = answers;
    let personId = 0;
    this.answers.forEach(a => {
      a.person.id = personId++;
    });

    this.candidates = answers.map(x => x.person);
    this.parties = [...new Set(this.candidates.map(x => x.party))].sort();
    this.cities = [...new Set(this.candidates.map(x => x.city))].sort();

    let choices = {};
    for (const c of answers) {
      for (const [key, val] of Object.entries(c.answers)) {
        choices[val] = true;
      }
    }
    choices = Object.keys(choices).map(parseFloat);

    const min = Math.min(...choices);
    const max = Math.max(...choices);
    const neutral = (min+max)*0.5;

    this.options = {
      max,
      min,
      neutral,
      maxScore:
      max - neutral,
      minScore: min - neutral
    };
  }

  scorePeople(opinions, people) {
    let score = 0.0;
    const bins = [];
    const selected = new Set(people.map(p => p.id));
    const nOps = Object.keys(opinions).length;
    const peopleWithAnswers = this.answers.filter(a => selected.has(a.person.id));
    const personWeight = 1.0 / peopleWithAnswers.length;
    peopleWithAnswers.map(person => {
      const scores = this._getPersonAnswerScores(person,opinions)
        .filter(op => op.didAnswer);

      if (!scores.length) return;

      const personScore = scores
        .map(op => op.matchScore)
        .reduce((a,b) => a+b) / nOps;

      bins[personScore] = (bins[personScore] || 0.0) + 1 * personWeight;
      score += personScore * personWeight;
    });

    return { score, bins };
  }

  getPersonAnswerScores(person, opinions) {
    return this._getPersonAnswerScores(this.answers[person.id], opinions);
  }

  _getPersonAnswerScores(person, opinions) {
    return Object.keys(opinions).map(id => {
      let ans = person.answers[id];
      return {
        id,
        didAnswer: ans !== undefined,
        matchScore: (ans - this.options.neutral)*opinions[id],
        answerScore: ans - this.options.neutral
      };
    });
  }

  sortedParties(parties, opinions) {
    parties = parties.map(party => ({
      name: party,
      ...this.scorePeople(
        opinions,
        this.candidates.filter(person => person.party === party))
    }));

    return parties.sort((a,b) => b.score - a.score);
  }
}
