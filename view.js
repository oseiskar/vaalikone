'use strict';
/* globals Model, Vue, document */

function createApp(vueElement) {
  let model = new Model();

  function toRgb(arr) {
    return 'rgb('+arr.map(x => x*255).map(Math.round).join(',')+')';
  }

  function colorMap(x, minX, maxX, brightness) {
    const colorScale = x => (x - minX) / (maxX - minX);

    let c = colorScale(x);

    let sat = Math.sqrt(Math.abs(c - 0.5)*2.0);
    const bright = brightness || sat*0.3 + 0.7;

    return toRgb([
        1.0 - (c-2/3)*3,
        c*2,
        0.0
      ]
      .map(v => Math.min(Math.max(v, 0), 1))
      .map(v => (v*sat + 1.0 - sat)*bright));
  }


  function _textColorMap(x, options) {
    if (x === undefined || x === null) return null;
    return 'color: ' + colorMap(x, options.minScore, options.maxScore, 0.7);
  }

  function _getHTMLArrow(score) {
    if (score > 0) return '&#8679;'; // arrow up
    else if (score < 0) return '&#8681;'; // arrow down
    return '&#9898;'; // hollow circle
  }

  Vue.component('histogram-plot', {
    template: `
      <svg :width="dimensions.width" :height="dimensions.height">
        <circle v-for="c in circles" :r="c.r" :cx="c.cx" :cy="c.cy" :fill="binColorMap(c.score)"/>
      </svg>`,
    props: ['dimensions', 'bins'],
    methods: {
      binColorMap(x) {
        return colorMap(x, model.options.minScore, model.options.maxScore, 0.9);
      },
      scoreToX(score) {
        const { minScore, maxScore } = model.options;
        const relX = (score - minScore) / (maxScore - minScore);
        return (relX * 0.8 + 0.1) * this.dimensions.width;
      }
    },
    computed: {
      circles() {
        const maxR = this.dimensions.height * 0.7;
        return Object.keys(this.bins).map(score => ({
          score,
          cx: this.scoreToX(score),
          cy: this.dimensions.height*0.5,
          r: Math.sqrt(this.bins[score]) * maxR
        }));
      }
    }
  });

  Vue.component('question-view', {
    template: '#question-template',
    props: ['party', 'city'],
    data() {
      const opinions = {};
      model.questions.forEach(q => {
        opinions[q.id] = null;
      });

      return {
        opinions
      };
    },
    methods: {
      textColorMap(x) { return _textColorMap(x, model.options); },
      getHTMLArrow(score) { return _getHTMLArrow(score); },
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
      }
    },
    watch: {
      nonEmptyOpinions() {
        this.$emit('opinions-changed', this.nonEmptyOpinions);
      }
    },
    computed: {
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

      sortedQuestions() {
        if (!this.party) {
          if (this.city) {
            // filter out questions with no answers from the selected city
            const cityPeople = model.candidates.filter(p => p.city === this.city);
            return model.questions
              .filter(q => model.scorePeople({ [q.id]: 1 }, cityPeople).bins.length > 0);
          } else {
            return model.questions;
          }
        }

        const partyPeople = model.candidates.filter(p => p.party === this.party);
        const questions = model.questions.map(question => ({
          score: model.scorePeople({ [question.id]: 1 }, partyPeople).score,
          ...question
        }))
        .sort((a,b) => b.score - a.score);

        return model.questions
          .filter(q => this.nonEmptyOpinions[q.id])
          .map(q => {
            const op = this.opinions[q.id];
            const score = model.scorePeople({ [q.id]: 1 }, partyPeople);
            if (!score.bins.length) return null;
            const matchScore = model.scorePeople({ [q.id]: op }, partyPeople).score;
            const roundedScore = (Math.round(score.score*100/model.options.maxScore));
            return {
              matchScore,
              shortTitle: (op*100) + ' vs ' + roundedScore,
              matchTitle: this.party + ': ' +  roundedScore,
              ...q
            };
          })
          .filter(x => x !== null) // drop questions with now answers in this group
          .concat(questions.filter(q => !this.nonEmptyOpinions[q.id]));
      }
    }
  });

  Vue.component('result-view', {
    template: '#result-template',
    props: ['nonEmptyOpinions', 'city'],
    data() {
      return {
        selectedParty: null,
        style: {
          plot: {
            width: 200,
            height: 30
          },
          resultHeight: window.innerHeight / 2 // TODO document.getElementById('result-box').clientHeight;
        }
      };
    },
    methods: {
      textColorMap(x) { return _textColorMap(x, model.options); },
      getHTMLArrow(score) { return _getHTMLArrow(score); },
      toggleSelectedParty(party) {
        if (this.selectedParty === party) {
          this.selectedParty = null;
        } else {
          this.selectedParty = party;
        }
      },
      truncateResults(results, rowHeight, margin = 0) {
        const maxResults = Math.max(3, Math.floor((this.style.resultHeight-margin) / rowHeight));

        if (results.length <= maxResults) return results;
        const nTop = Math.ceil((maxResults-1)/2);
        const nBottom = Math.floor((maxResults-1)/2);
        return results.slice(0, nTop)
          .concat([{ellipsis: true}])
          .concat(results.slice(-nBottom));
      }
    },
    watch: {
      selectedParty() {
        this.$emit('party-changed', this.selectedParty);
      }
    },
    computed: {
      anyOpinions() {
        return Object.keys(this.nonEmptyOpinions).length > 0;
      },

      parties() {
        return model.parties.filter(party => {
          return !this.city ||
            model.candidates.filter(p =>
              p.city === this.city &&
              p.party === party).length > 0;
        });
      },

      sortedParties() {
        if (!this.anyOpinions)
          return this.parties.map(p => ({ name: p }));

        const maxR = this.style.plot.height * 0.7;
        return this.truncateResults(
          model.sortedParties(this.parties, this.nonEmptyOpinions),
          this.style.plot.height + 10
        );
      },

      sortedCandidates() {
        if (!this.selectedParty) return [];
        let partyPeople = model.candidates
          .filter(p => p.party === this.selectedParty)
          .filter(p => !this.city || p.city === this.city);

        const rowH = 28, margin = 40;
        if (!this.anyOpinions) return this.truncateResults(partyPeople, rowH, margin);

        return this.truncateResults(partyPeople.map(person => ({
          score: model.scorePeople(this.nonEmptyOpinions, [person]).score,
          answers: model.getPersonAnswerScores(person, this.nonEmptyOpinions)
            .map(op => ({
              question: model.questionsById[op.id],
              ...op
            })),
          ...person
        }))
        .sort((a,b) => b.score - a.score), rowH, margin);
      }
    }
  });

  function newApp() {
    return new Vue({
      el: vueElement,
      data: {
        copyright: {},
        cities: [],
        nonEmptyOpinions: {},
        error: null,
        selected: {
          party: null,
          city: null
        }
      },
      methods: {
        opinionsChanged(opinions) {
          this.nonEmptyOpinions = opinions;
        },

        partyChanged(party) {
          this.selected.party = party;
        }
      }
    });
  }

  return {
    start({questions, answers, meta} = {}) {
      document.title = meta.title;
      model = new Model(questions, answers);
      const app = newApp();
      app.cities = model.cities;
      app.copyright = meta.copyright;
    },
    error(error) {
      newApp().error = error;
    }
  };
}
