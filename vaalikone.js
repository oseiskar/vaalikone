'use strict';
/* globals _, d3 */

function preprocessAnswers(peopleWithAnswers) {
    peopleWithAnswers.forEach(person => {
        // round all answers to integer values
        person.answers = _.mapValues(person.answers, Math.round);
    });

    const answerOptions = _.uniq(
        _.flatten(peopleWithAnswers.map(d => _.values(d.answers)))
    );

    const neutralAnswer = _.mean(answerOptions);

    peopleWithAnswers.forEach(person => {
        // round all answers to integer values
        person.answers = _.mapValues(person.answers, a => a - neutralAnswer);
    });
}

function Main(questions, peopleWithAnswers, d3root) {
    this.cities = _.uniq(peopleWithAnswers.map(p => p.person.city)).sort();

    preprocessAnswers(peopleWithAnswers);

    function getPeopleForCity(city) {
        if (city === undefined) {
            return peopleWithAnswers;
        } else {
            return peopleWithAnswers.filter(p => p.person.city === city);
        }
    }

    this.getPeopleForCity = getPeopleForCity;

    this.getQuestionsForCity = function(city) {
        const people = getPeopleForCity(city);
        const questionIds = _.uniq(_.flatMap(people, p => _.keys(p.answers)));
        return _.pick(questions, questionIds);
    };

    this.render(d3root);
}

Main.prototype.renderCity = function(city) {
    let opinions = {};
    if (this.vaalikone) {
        opinions = this.vaalikone.opinions;
    }
    this.vaalikone = new Vaalikone(
        this.getQuestionsForCity(city),
        this.getPeopleForCity(city),
        opinions);

    this.vaalikone.start(this.questionList, this.graphColumn);
};

Main.prototype.render = function(d3root) {
    const container = d3root
        .append('div')
        .classed('row', true);

    const leftColumn = container
        .append('div')
        .classed('question-column', true);

    const that = this;
    leftColumn.append('div')
        .classed('form-group', true)
            .append('select')
            .classed('form-control', true)
            .on('change', function () {
                let city = d3.select(this).property('value');
                if (city === '') {
                    city = undefined;
                }
                that.renderCity(city);
            })
            .selectAll('option')
            .data(_.concat([''], this.cities))
            .enter()
            .append('option')
            .text(d => d);

    this.questionList = leftColumn.append('ul');

    this.graphColumn =
        container
            .append('div')
            .classed('graph-column', true);

    this.renderCity();
};

function Vaalikone(questions, peopleWithAnswers, opinions) {
    const partyAnswers = d3.nest()
        .key(d => d.person.party)
        .entries(peopleWithAnswers);

    this.questions = questions;
    this.parties = partyAnswers.map(d => d.key);
    this.peopleWithAnswers = peopleWithAnswers;

    this.partyAnswerMatrix = _.fromPairs(
        partyAnswers.map(group => [
            group.key,
            _.fromPairs(
                _.keys(questions).map(q => [
                    q,
                    group.values
                        .map(d => d.answers[q])
                        .filter(x => x !== undefined)
                ])
            )
        ])
    );

    this.answerOptions = _.uniq(
        _.flatten(peopleWithAnswers.map(d => _.values(d.answers)))
    );
    this.answerOptions.sort();

    this.opinions = opinions;

    this.subplotSize = {
        w: 200,
        h: 50
    };
}

Vaalikone.prototype.toggleOpinion = function(question, newOpinion) {
    if (this.opinions[question] === newOpinion) {
        delete this.opinions[question];
    } else {
        this.opinions[question] = newOpinion;
    }
    this.render();
};

Vaalikone.prototype.getColorMaps = function(bins) {
    const minX = d3.min(bins);
    const colorScale = d3.scaleLinear()
        .domain([minX, d3.max(bins)])
        .range([0, 1]);

    const rgb = (arr) => 'rgb('+arr.map(x => x*255).map(Math.round).join(',')+')';

    const colorMap = (brightness) => {
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
    };

    return {
        'histogram': colorMap(),
        'text': colorMap(0.7)
    };
};

Vaalikone.prototype.computeMean = function(histogram) {
    return _.sum(_.map(histogram, (v, k) => k*v)) / _.sum(_.values(histogram));
};

Vaalikone.prototype.renderHistogram = function(d3root, data, bins) {
    const total = _.sum(_.values(data));

    const barWidth = this.subplotSize.w / (bins.length+1);
    const minX = d3.min(bins);
    const maxR = barWidth / Math.sqrt(2);
    const maxHeight = this.subplotSize.h;
    const xStart = 0.5 / Math.sqrt(2) * barWidth;

    const radius = x => Math.sqrt((data[x] || 0) / total) * maxR;

    const bars = d3root
        .selectAll('circle')
        .data(bins);

    bars.exit().remove();

    const colorMaps = this.getColorMaps(bins);

    bars
        .enter()
            .append('circle')
        .merge(bars)
            .attr('cx', x => (x-minX + 0.5) * barWidth + xStart)
            .attr('cy', maxHeight*0.5)
            .attr('fill', colorMaps.histogram)
            .transition()
            .attr('r', radius);

    return colorMaps.text(this.computeMean(data));
};

Vaalikone.prototype.renderPartyRow = function(d3root, party, data, bins, onClick, selectedParty) {
    const title = d3root
        .selectAll('div.title')
        .data([party]);

    const that = this;
    const titleText = title
        .enter()
            .append('div')
            .classed('title', true)
            .classed('col-4', true)
        .merge(title)
            .text(d => d)
            .on('click', onClick);

    const histogram = d3root
        .selectAll('div.histogram')
        .data([party]);

    let color =
        this.renderHistogram(histogram
            .enter()
                .append('div')
                .classed('histogram', true)
                .classed('col', true)
                    .append('svg')
                        .attr('width', this.subplotSize.w)
                        .attr('height', this.subplotSize.h)
                    .merge(histogram), data, bins);

    if (selectedParty) {
        titleText.style('font-weight', selectedParty === party ? 'bold' : 'normal');
        titleText.style('color', selectedParty === party ? 'black' : 'gray');
    } else {
        titleText.style('color', color);
    }
};

Vaalikone.prototype.renderQuestion = function(questionId, selectedParty) {
    const byParty = _.mapValues(this.partyAnswerMatrix,
        answers => _.fromPairs(d3.nest()
            .key(d => d).sortKeys(d3.ascending)
            .rollup(d => d.length)
            .entries(answers[questionId])
            .map(obj => [obj.key, obj.value])));

    //console.log(byParty);

    if (!_.isEmpty(this.opinions)) this.graphColumn.html(''); // clear

    const parties = _.keys(byParty).filter(p => !_.isEmpty(byParty[p]));
    const means = _.fromPairs(
        parties.map(p => [p, this.computeMean(byParty[p])]));

    const subplots = this.graphColumn
        .selectAll('div.row')
        .data(_.sortBy(parties, p => -means[p]));

    subplots.exit().remove();

    const that = this;
    subplots.enter()
            .append('div')
            .classed('row', true)
        .merge(subplots)
            .transition()
            .each(function(party) {
                function onClick() {
                    that.renderQuestion(questionId, party);
                    that.renderQuestionList(party);
                }
                that.renderPartyRow(d3.select(this),
                    party,
                    byParty[party],
                    that.answerOptions,
                    onClick,
                    selectedParty);
            });
};

Vaalikone.prototype.getPersonMatches = function() {
    const selected = _.keys(this.opinions);

    function answerMatch(opinion, ans) {
        return opinion * ans;
    }

    return this.peopleWithAnswers.map(p => {
        const answered = _.pickBy(
            _.pick(p.answers, selected),
            (v, k) => v !== undefined);

        let match = 0;
        if (!_.isEmpty(answered)) {
            match = _.sum(_.map(answered, (ans, qId) =>
                answerMatch(this.opinions[qId], ans)));
        }

        return { 'person': p.person, 'match': match, 'answers': answered };
    });
};

Vaalikone.prototype.renderPeopleMatches = function(party) {
    const personMatches = this.getPersonMatches();

    const allValues = _.uniq(_.flatMap(personMatches, p => p.match));
    const bins = _.range(d3.min(allValues), d3.max(allValues)+1);

    const people = _.sortBy(
        personMatches.filter(p => p.person.party === party),
        p => -p.match);

    this.graphColumn.html('');

    const title =
        this.graphColumn
            .append('h4');

    title
        .append('span')
        .text(party + ' ');

    title
        .append('span')
        .html('&#10060;')
        .style('font-size', 16) // cross mark;
        .on('click', d => {
            this.graphColumn.html('');
            this.renderOpinionMatches();
        });

    const rows = this.graphColumn
        .selectAll('div.row')
        .data(people)
        .enter()
        .append('div')
        .classed('row', true);

    const textColorMap = this.getColorMaps(bins).text;

    rows.append('div')
        .classed('col', true)
        .classed('person-name', true)
        .text(p => p.person.name)
        .style('color', p => textColorMap(p.match));

    const personAnsColorMap = this.getColorMaps(this.answerOptions).text;

    const that = this;
    rows.append('div')
        .classed('col', true)
        .style('font-face', 'monospace')
        .each(function(p) {
            d3.select(this)
                .selectAll('span')
                .data(_.keys(that.opinions))
                .enter()
                    .append('span')
                    .html(qId => {
                        const ans = p.answers[qId];
                        if (ans !== undefined) {
                            if (ans > 0) {
                                return '&#8679;'; // arrow up
                            } else if (ans === 0) {
                                return '&#9898;'; // white circle
                            } else {
                                return '&#8681;'; // arrow down
                            }
                        } else {
                            return '-';
                        }
                    })
                    .style('color', qId => {
                        const ans = p.answers[qId];
                        if (ans !== undefined) {
                            return personAnsColorMap(ans * that.opinions[qId]);
                        } else {
                            return 'gray';
                        }
                    })
                    .attr('title', qId => that.questions[qId]);
        });
};

Vaalikone.prototype.renderOpinionMatches = function(selectedParty) {
    const personMatches = this.getPersonMatches();

    const allValues = _.uniq(_.flatMap(personMatches, p => p.match));
    const bins = _.range(d3.min(allValues), d3.max(allValues)+1);

    const partyPeople = _.fromPairs(d3.nest()
        .key(p => p.person.party)
        .entries(personMatches)
        .map(obj => [obj.key, obj.values]));

    const byParty =  _.mapValues(partyPeople,
        people => _.fromPairs(d3.nest()
            .key(d => d).sortKeys(d3.ascending)
            .rollup(d => d.length)
            .entries(people.map(p => p.match))
            .map(obj => [obj.key, obj.value])));

    const means = _.mapValues(byParty, (data) => this.computeMean(data));
    const subplots = this.graphColumn
        .selectAll('div.row')
        .data(_.sortBy(_.keys(byParty), p => -means[p]));

    subplots.exit().remove();

    const that = this;
    subplots.enter()
            .append('div')
            .classed('row', true)
        .merge(subplots)
            .transition()
            .each(function(party) {
                function onClick() {
                    //that.renderOpinionMatches(party);
                    that.renderQuestionList(party);
                    that.renderPeopleMatches(party);
                }
                that.renderPartyRow(d3.select(this),
                    party,
                    byParty[party],
                    bins,
                    onClick,
                    selectedParty);
            });
};

Vaalikone.prototype.renderQuestionList = function(party) {
    let data = _.toPairs(this.questions)
        .map(d => { return { id: d[0], text: d[1] }; });

    const opinionWeight = (d) => {
        const LARGE_NUMBER = 100000;
        const op = this.opinions[d.id];
        if (op === undefined) {
            return 0;
        } else {
            if (op > 0) {
                return LARGE_NUMBER*2;
            } else {
                return LARGE_NUMBER;
            }
        }
    };

    if (party) {
        const byQuestion = _.fromPairs(_.keys(this.questions)
            .map(questionId => {
                const means =_.mapValues(this.partyAnswerMatrix,
                    answers => _.mean(answers[questionId]));

                return [
                    questionId,
                    {
                        partyMean: means[party],
                        meanOfMeans: _.mean(_.values(means).filter(_.isFinite))
                    }
                ];
            })
        );

        //console.log(byQuestion);

        data.forEach(d => {
            d.partyValue = byQuestion[d.id].partyMean;
        });

        data = data.filter(d => this.partyAnswerMatrix[party][d.id].length > 0);
        data = _.sortBy(data, d => {
            const agreeWeight = d.partyValue - byQuestion[d.id].meanOfMeans;
            return -(opinionWeight(d) + agreeWeight);
        });
    } else {
        data = _.sortBy(data, d => -opinionWeight(d));
    }

    this.questionList.html(''); // clear

    const NO_ACTION = 'javascript:void(0)';

    const questions =  this.questionList
        .selectAll('li')
        .data(data)
        .enter()
            .append('li');

    const addArrow = (value, symbol, color) => {
        questions
            .append('a')
            .attr('href', NO_ACTION)
            .classed('strong', true)
            .html(symbol)
            .style('color', d => {
                if (this.opinions[d.id] === value) {
                    return color;
                } else {
                    return 'black';
                }
            })
            .on('mousedown', d => this.toggleOpinion(d.id, value));
    };

    addArrow(+1, '&#8679;', 'green');
    addArrow(-1, '&#8681;', 'red');

    const textColorMap = this.getColorMaps(this.answerOptions).text;

    questions
            .append('a')
            .attr('href', NO_ACTION)
            .on('mousedown', d => this.renderQuestion(d.id, party))
            .text(d => ' ' + d.text)
            .attr('style', d => {
                if (party) {
                    return 'color: ' + textColorMap(d.partyValue);
                }
                return '';
            });
};

Vaalikone.prototype.render = function() {
    this.renderQuestionList();

    this.graphColumn.html('');
    if (_.isEmpty(this.opinions)) {
        this.renderQuestionList();
    } else {
        this.renderOpinionMatches();
    }
};

Vaalikone.prototype.start = function(questionList, graphColumn) {
    this.questionList = questionList;
    this.graphColumn = graphColumn;
    this.render();
};
