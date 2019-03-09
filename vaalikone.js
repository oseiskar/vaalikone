'use strict';
/* globals _, d3 */

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
      const personScore = this._getPersonAnswerScores(person,opinions)
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
      if (ans === undefined) return 0;
      return (ans - this.options.neutral)*opinions[id];
    });
  }

  static getColorMap(scores, brightness) {
    const minX = Math.min(...scores);

    const colorScale = d3.scaleLinear()
      .domain([minX, Math.max(...scores)])
      .range([0, 1]);

    const rgb = (arr) => 'rgb('+arr.map(x => x*255).map(Math.round).join(',')+')';

    return x => {
      let c = colorScale(x);

      let sat = Math.sqrt(Math.abs(c - 0.5)*2.0);
      const bright = brightness || sat*0.3 + 0.7;

      return rgb([
          1.0 - (c-2/3)*3,
          c*2,
          0.0
        ]
        .map(v => Math.min(Math.max(v, 0), 1))
        .map(v => (v*sat + 1.0 - sat)*bright));
    };
  }
}
