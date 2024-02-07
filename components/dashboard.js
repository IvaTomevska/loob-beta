import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ThemeButton from './ThemeButton';

const sampleWordsData = [
  { text: 'happy', frequency: 20, sentiment: 'positive' },
  { text: 'sad', frequency: 15, sentiment: 'negative' },
  { text: 'love', frequency: 18, sentiment: 'positive' },
  { text: 'angry', frequency: 12, sentiment: 'negative' },
  { text: 'excited', frequency: 25, sentiment: 'positive' },
];

const sampleMoodData = [
  { name: 'Positive', value: 40 },
  { name: 'Negative', value: 30 },
  { name: 'Neutral', value: 20 },
];

const sampleSentimentData = [
  { name: 'Positive', value: 25 },
  { name: 'Negative', value: 15 },
  { name: 'Neutral', value: 10 },
];

const sampleConversationLengthData = [
  { name: 'Session 1', length: 10 },
  { name: 'Session 2', length: 15 },
  { name: 'Session 3', length: 8 },
  { name: 'Session 4', length: 12 },
  { name: 'Session 5', length: 20 },
];

const Dashboard = () => {
  const [theme, setTheme] = useState('dark');
  const [wordsData, setWordsData] = useState(sampleWordsData);
  const [moodData, setMoodData] = useState(sampleMoodData);
  const [sentimentData, setSentimentData] = useState(sampleSentimentData);
  const [conversationLengthData, setConversationLengthData] = useState(sampleConversationLengthData);
  const wordCloudRef = useRef();
  const barChartRef = useRef();
  const lineChartRef = useRef();

  useEffect(() => {
    if (wordsData.length > 0) {
      drawWordCloud(wordsData);
    }
  }, [wordsData]);

  const drawWordCloud = (words) => {
    d3.select(wordCloudRef.current).selectAll('*').remove();

    const layout = cloud()
      .size([800, 600])
      .words(words.map(d => ({ text: d.text, size: d.frequency * 10 + 10 })))
      .padding(5)
      .rotate(() => (~~(Math.random() * 6) - 3) * 30)
      .font('Impact')
      .fontSize(d => d.size)
      .on('end', draw);

    layout.start();

    function draw(words) {
      const svg = d3.select(wordCloudRef.current)
        .append('svg')
        .attr('width', layout.size()[0])
        .attr('height', layout.size()[1])
        .append('g')
        .attr('transform', `translate(${layout.size()[0] / 2},${layout.size()[1] / 2})`);

      svg.selectAll('text')
        .data(words)
        .enter().append('text')
        .style('font-size', d => d.size + 'px')
        .style('font-family', 'Impact')
        .style('fill', d => (d.sentiment === 'positive' ? 'green' : 'red'))
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${[d.x, d.y]})rotate(${d.rotate})`)
        .text(d => d.text);
    }
  };

return (
  <main className={`flex flex-col items-center justify-center h-screen ${theme === 'dark' ? 'dark' : 'light'} p-4`}>
    <section className="chatbot-section w-full max-w-4xl rounded-md overflow-hidden shadow-lg">
      <div className="flex justify-between items-center mb-6 p-4">
        <h1 className="chatbot-text-primary text-3xl md:text-4xl font-bold tracking-wide">
          Journaling Dashboard
        </h1>
        <ThemeButton theme={theme} setTheme={setTheme} />
      </div>
      <div className="grid md:grid-cols-2 gap-4 p-4">
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="chatbot-text-primary text-xl mb-2">Word Cloud</h2>
          <div ref={wordCloudRef} className="word-cloud-container"></div>
        </div>
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="chatbot-text-primary text-xl mb-2">Mood Distribution</h2>
          <PieChart width={300} height={300}>
            {/* PieChart content */}
          </PieChart>
        </div>
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="chatbot-text-primary text-xl mb-2">Sentiment Analysis</h2>
          <BarChart width={300} height={300} data={sentimentData}>
            {/* BarChart content */}
          </BarChart>
        </div>
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="chatbot-text-primary text-xl mb-2">Conversation Length Analysis</h2>
          <LineChart width={300} height={300} data={conversationLengthData}>
            {/* LineChart content */}
          </LineChart>
        </div>
      </div>
    </section>
  </main>
);
};

export default Dashboard;