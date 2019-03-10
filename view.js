'use strict';
/* globals Model, Vue, document */

function createApp(vueElement) {
  let model = new Model([]);

  const app = new Vue({
    el: vueElement,
    data: {
      questions: [],
      allParties: [],
      options: [],
      cities: [],
      selected: {
        party: null,
        city: null
      },
      opinions: {},
      style: {
        plot: {
          width: 200,
          height: 30
        },
        resultHeight: 200
      }
    },
    methods: {
      colorMap(x, brightness) {
        const minX = this.options.minScore;
        const maxX = this.options.maxScore;
        const colorScale = x => (x - minX) / (maxX - minX);
        const rgb = (arr) => 'rgb('+arr.map(x => x*255).map(Math.round).join(',')+')';

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
      },
      textColorMap(x) {
        if (x === undefined || x === null) return null;
        return 'color: ' + this.colorMap(x, 0.7);
      },
      binColorMap(x) {
        if (x === undefined || x === null) return null;
        return this.colorMap(x, 0.9);
      },
      toggleSelectedParty(party) {
        if (this.selected.party === party) {
          this.selected.party = null;
        } else {
          this.selected.party = party;
        }
      },
      toggleOpinion(id, sign) {
        if (this.opinions[id] === sign)
          this.opinions[id] = null;
        else
          this.opinions[id] = sign;
      },
      arrowClass(id, sign) {
        if (this.opinions[id] === sign) {
          return 'selected-' + (sign > 0 ? 'positive' : 'negative');
        }
      },
      truncateResults(results, rowHeight) {
        const margin = 40;
        const maxResults = Math.max(3, Math.floor((this.style.resultHeight-margin) / rowHeight));

        if (results.length <= maxResults) return results;
        const nTop = Math.ceil((maxResults-1)/2);
        const nBottom = Math.floor((maxResults-1)/2);
        return results.slice(0, nTop)
          .concat([{ellipsis: true}])
          .concat(results.slice(-nBottom));
      },
      setAnswerData(answers) {
        model = new Model(answers);
        this.cities = [...model.cities];
        this.options = {...model.options};
        this.candidates = [...model.candidates];
        this.allParties = [...model.parties];
      }
    },
    watch: {
      questions() {
        // make all opinions reactive
        this.questions.forEach(question => {
          Vue.set(this.opinions, question.id, null);
        });
      }
    },
    computed: {
      parties() {
        return this.allParties.filter(party => {
          return !this.selected.city ||
            this.candidates.filter(p =>
              p.city === this.selected.city &&
              p.party === party).length > 0;
        });
      },

      questionsById() {
        const qById = [];
        this.questions.forEach(q => { qById[q.id] = q.question; });
        return qById;
      },

      nonEmptyOpinions() {
        const opinions = {};
        for (const [key, value] of Object.entries(this.opinions)) {
          if (value) opinions[key] = value;
        }
        return opinions;
      },

      anyOpinions() {
        return Object.keys(this.nonEmptyOpinions).length > 0;
      },

      sortedParties() {
        if (!this.anyOpinions)
          return this.parties.map(p => ({ name: p }));

        const maxR = this.style.plot.height * 0.7;
        return this.truncateResults(
          model.sortedParties(this.parties, this.nonEmptyOpinions).map(party => {
            party.score = party.results.score;
            party.bins = party.bins.map(b => ({
              cx: (b.relX * 0.8 + 0.1) * this.style.plot.width,
              cy: this.style.plot.height*0.5,
              r: Math.sqrt(b.weight) * maxR,
              score: b.score
            }));
            return party;
          }),
          this.style.plot.height + 10
        );
      },

      sortedQuestions() {
        if (!this.selected.party) return this.questions;

        const partyPeople = this.candidates.filter(p => p.party === this.selected.party);
        const questions = this.questions.map(question => ({
          score: model.scorePeople({ [question.id]: 1 }, partyPeople).score,
          ...question
        }))
        .sort((a,b) => b.score - a.score);

        return this.questions
          .filter(q => this.nonEmptyOpinions[q.id])
          .concat(questions.filter(q => !this.nonEmptyOpinions[q.id]));
      },

      sortedCandidates() {
        if (!this.selected.party) return [];
        let partyPeople = this.candidates
          .filter(p => p.party === this.selected.party)
          .filter(p => !this.selected.city || p.city === this.selected.city);

        const rowH = 28;
        if (!this.anyOpinions) return this.truncateResults(partyPeople, rowH);

        return this.truncateResults(partyPeople.map(person => ({
          score: model.scorePeople(this.nonEmptyOpinions, [person]).score,
          answers: model.getPersonAnswerScores(person, this.nonEmptyOpinions)
            .map(op => ({
              question: this.questionsById[op.id],
              ...op
            })),
          ...person
        }))
        .sort((a,b) => b.score - a.score), rowH);
      }
    }
  });

  return {
    start({questions, answers} = {}) {
      app.style.resultHeight = document.getElementById('result-box').clientHeight;
      app.questions = Object.keys(questions).map(q => ({
        id: q,
        question: questions[q]
      }));
      app.setAnswerData(answers);
    }
  };
}
